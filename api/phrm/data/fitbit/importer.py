from fitbit import Fitbit
import pandas as pd
import sqlite3
from datetime import datetime
import pprint
import os
import pickle

import sqlite3


class FitbitImporter:
    def __init__(self, CLIENT_ID, CLIENT_SECRET):
        self.CLIENT_ID = CLIENT_ID
        self.CLIENT_SECRET = CLIENT_SECRET
        self.data_cache = {}

        self.DB = "data/fitbit/raw/fitbit_raw_data.sqlite3"
        self.token_file = "data/fitbit/token/token.pickle"

        self.init_base_tables()

        self.cache = {}

        self.is_authenticated = False

        if os.path.exists(self.token_file):
            with open(self.token_file, 'rb') as f:
                self.token = pickle.load(f)

                ACCESS_TOKEN = str(self.token['access_token'])
                REFRESH_TOKEN = str(self.token['refresh_token'])
                EXPIRES_AT = float(str(self.token['expires_at']))

            self.fitbit = Fitbit(
                self.CLIENT_ID,
                self.CLIENT_SECRET,
                oauth2=True,
                redirect_uri="http://localhost:8080/api/fitbit_auth_redirect",
                access_token=ACCESS_TOKEN,
                refresh_token=REFRESH_TOKEN,
                expires_at=EXPIRES_AT,
                refresh_cb=self.refresh_cb,
            )
            self.is_authenticated = True
        else:
            self.fitbit = Fitbit(
                self.CLIENT_ID,
                self.CLIENT_SECRET,
                oauth2=True,
                redirect_uri="http://localhost:8080/api/fitbit_auth_redirect",
                refresh_cb=self.refresh_cb,
            )

    def oauth2_token(self, state, code):
        self.fitbit.client.fetch_access_token(code)
    
        os.makedirs("data/fitbit/token", exist_ok=True)

        with open(self.token_file, "wb") as f:
            pprint.pprint(self.fitbit.client.session.token)
            pickle.dump(self.fitbit.client.session.token, f)

        self.is_authenticated = True
        

    def init_base_tables(self):
        os.makedirs("data/fitbit/raw", exist_ok=True)

        conn = sqlite3.connect(self.DB)
        
        cursor =  conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS raw_data (day int, seconds int, value int)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_data_day ON raw_data (day)")

        cursor.execute("CREATE TABLE IF NOT EXISTS raw_data_finished (day int)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_data_finished_day ON raw_data_finished (day)")

        conn.commit()

    def get_data(self, days):
        conn = sqlite3.connect(self.DB)
        result = pd.read_sql_query(f"select * from raw_data where day in ({','.join([str(x) for x in days])})", conn)
        conn.close()

        return result

    def get_finished_days(self):
        sql = "select day from raw_data_finished"

        conn = sqlite3.connect(self.DB)
        result = pd.read_sql_query(sql, conn).day.values.tolist()
        conn.close()

        return result


    def download_days(self,days):
        today = int(datetime.now().strftime("%Y%m%d"))

        # Delete all days in the future from the list
        days = [x for x in days if x <= today]

        # Determine which days we have already. Those should not be taken
        finished_days = self.get_finished_days()

        missing_days = [x for x in days if x not in finished_days]
        print(f"Missing raw days are {missing_days}")

        conn = sqlite3.connect(self.DB)
        cursor = conn.cursor()

        for day in missing_days:
            print(f"Downloading raw day {day} from fitbit")

            day_formatted = datetime.strptime(str(day), "%Y%m%d").strftime("%Y-%m-%d")
            raw_data = self.get_raw_hr_data(day_formatted)
            if len(raw_data):
                print(f"Inserting raw data for day {day} in table")
                raw_data.loc[:, 'day'] = day
                raw_data.loc[:, 'seconds'] = (pd.to_timedelta(raw_data.time ,unit="s").astype(int) // 1e9).astype(int)

                raw_data = raw_data.loc[: , ['day', 'seconds', 'value']]

                # Now delete the existing raw data
                cursor.execute(f'DELETE FROM raw_data where day={day}')
                raw_data.to_sql('raw_data', conn, index=False, if_exists="append", chunksize=1000)
                
            else:
                print(f"Day {day} does not have any data")


            # Only if the day is not equal to today, then we 'commit' this day: we
            # consider we have the complete data set for this day
            if day != today:
                cursor.execute(f"DELETE FROM raw_data_finished where day={day}")
                cursor.execute(f'INSERT INTO raw_data_finished ("day") VALUES ({day})')
                conn.commit()

    def refresh_cb(self, token):
        """ Called when the OAuth token has been refreshed """
        print("Refreshing tokens")
        access_token = token['access_token']
        refresh_token = token['refresh_token']
        expires_at = token['expires_at']

        with open(self.token_file, 'wb') as f:
            pickle.dump(token, f)


    def obtain_tokens(self):
        pass
        # if not os.path.exists(self.token_file):
        #     server = Oauth2.OAuth2Server(self.CLIENT_ID, self.CLIENT_SECRET)
        #     server.browser_authorize()

        #     with open(self.token_file) as f:
        #         pprint.pprint(server.fitbit.client.session.token)
        #         pickle.dump(server.fitbit.client.session.token, f)

    def get_raw_hr_data(self, day):
        """Retrieve the raw HR data for a given day from fitbit

        Args:
            day:
              String representing the day we wan to get. The string should be formatted in
              the format YYYY-MM-DD
        """
        # self.obtain_tokens()
        
        print("Retrieving heart-rate data for day {} from fitbit API".format(day))
        with open(self.token_file, 'rb') as f:
            token = pickle.load(f)

            ACCESS_TOKEN = str(token['access_token'])
            REFRESH_TOKEN = str(token['refresh_token'])
            EXPIRES_AT = float(str(token['expires_at']))


        fb_data = self.fitbit.intraday_time_series('activities/heart', base_date=day, detail_level='1sec')
        df_hr_data = pd.DataFrame(fb_data['activities-heart-intraday']['dataset']) 
        return df_hr_data     
