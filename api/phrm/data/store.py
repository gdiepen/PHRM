import sqlite3
import math
import pandas as pd
from datetime import datetime
from .fitbit.importer import Importer

class Store:
    def __init__(self, CLIENT_ID, CLIENT_SECRET):
        self.CLIENT_ID = CLIENT_ID
        self.CLIENT_SECRET = CLIENT_SECRET

        self.init_tables()
        self.fb_importer = Importer(self.CLIENT_ID, self.CLIENT_SECRET)

        self.cache_today = None

    def init_tables(self):
        conn = sqlite3.connect('phrm.sqlite3')
        
        cursor =  conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS phrm (day string, weekday int, bucket int, value double)")
        cursor.execute("CREATE INDEX IF NOT EXISTS index_day ON phrm (day)")
        cursor.execute("CREATE INDEX IF NOT EXISTS index_bucket ON phrm (bucket)")
        cursor.execute("CREATE INDEX IF NOT EXISTS index_weekday ON phrm (weekday)")

        cursor.execute("CREATE TABLE IF NOT EXISTS phrm_processed_days (day string)")
        cursor.execute("CREATE INDEX IF NOT EXISTS index_day ON phrm_processed_days (day)")
        conn.commit()





    def to_chunks(self, l, n):
        for i in range( math.ceil( len(l)/ n ) ):
            yield l[i*n:((i+1)*n)]

    def refresh_data(self, range_start, range_end):
        days = pd.date_range(range_start, range_end, freq="D").strftime("%Y-%m-%d").tolist()
        self.ensure_data(days)

    def get_daily_data(self, day):
        conn = sqlite3.connect('phrm.sqlite3')
        result = pd.read_sql_query(f"select * from phrm where day='{day}'", conn)
        conn.close()

        result.loc[:, 'hours_since_midnight'] = 60 * result.bucket / 3600
        result.drop( ['bucket'], axis=1, inplace=True)
   
        return result

    def get_range(self, range_start, range_end, interval=0.6, weekday_filter=None):
        if not weekday_filter:
            weekday_filter = list(range(7))

        weekday_filter = [str(x) for x in weekday_filter]

        sql = f"select bucket,value from phrm where day >= '{range_start}' and day <= '{range_end}' and weekday in ({','.join(weekday_filter)})"
        conn = sqlite3.connect('phrm.sqlite3')
        result = pd.read_sql_query(sql, conn)
        conn.close()


        result.loc[:, 'hours_since_midnight'] = 60 * result.bucket / 3600
        result.drop( ['bucket'], axis=1, inplace=True)

        quantile_top = 1 - (1-interval)/2.0
        quantile_bottom = (1-interval)/2.0

        a_m = result.groupby("hours_since_midnight").quantile(0.5).value
        a_h = result.groupby("hours_since_midnight").quantile(quantile_top).value
        a_l = result.groupby("hours_since_midnight").quantile(quantile_bottom).value


        return (a_m, a_h, a_l)

    def get_available_days(self):
        sql = "select * from phrm_processed_days"

        conn = sqlite3.connect('phrm.sqlite3')
        result = pd.read_sql_query(sql, conn).day.values.tolist()
        conn.close()

        return result

    def ensure_data(self,days):

        today = datetime.now().strftime("%Y-%m-%d")

        # Delete all days in the future from the list
        days = [x for x in days if x <= today]


        # Determine which days we have already. Those should not be taken
        available_days = self.get_available_days()

        missing_days = [x for x in days if x not in available_days]
        print(f"Missing days are {missing_days}")

        conn = sqlite3.connect('phrm.sqlite3')
        process_chunks = self.to_chunks(missing_days, 5)
        for process_chunk in process_chunks:
            df_result = self.fb_importer.retrieve_processed_data(process_chunk)

            if df_result is not None:
                # and now we can write this to the database (except for today)
                print(f"Writing days {list(df_result.day.unique())} to database")
                df_result = df_result.loc[:, ["day", "weekday", "bucket", "value"]]

                # Delete any of the existing days (should not be the case)
                # Just to be sure
                days_to_delete = '","'.join(df_result.day.unique())

                cursor = conn.cursor()
                cursor.execute(f'DELETE FROM phrm where day in ("{days_to_delete}")')

                df_result.to_sql('phrm', conn, index=False, if_exists="append", chunksize=1000)

            # and also indicate we have finished writing the missing days
            # Because the day of today is not completely processed yet, we have to delete it from the list
            process_chunk = [x for x in process_chunk if x != today]
            days_processed = '("' +  '"),("'.join(process_chunk) + '")'
            print(f"completely processed days: {days_processed}")
            cursor = conn.cursor()
            cursor.execute(f'INSERT OR REPLACE INTO phrm_processed_days ("day") VALUES {days_processed}')
            conn.commit()

