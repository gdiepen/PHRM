import fitbit
import pandas as pd
import itertools
import sqlite3
from datetime import datetime
import os
import pickle

from . import importer
import sqlite3

from astropy.convolution import Gaussian1DKernel, convolve

class FitbitProcessedDataStore:
    def __init__(self, fitbit_importer, settings):
        self.data_cache = {}

        self.moving_average_bucket_size = settings.get("moving_average_bucket_size")
        self.moving_average_window = settings.get("moving_average_window")

        if self.moving_average_window is not None:
            self.moving_average_window = int(self.moving_average_window)
        if self.moving_average_bucket_size is not None:
            self.moving_average_bucket_size = int(self.moving_average_bucket_size)



        self.gaussian_bucket_size = settings.get("gaussian_bucket_size")
        self.gaussian_stddev = settings.get("gaussian_stddev")



        if self.gaussian_stddev is not None:
            self.gaussian_stddev = float(self.gaussian_stddev)
        if self.gaussian_bucket_size is not None:
            self.gaussian_bucket_size = int(self.gaussian_bucket_size)


        self.smoothing_method = settings.get("smoothing_method")

        if self.smoothing_method == "gaussian":
            self.DB = f"data/fitbit/processed/fitbit_data_gaussian_{self.gaussian_bucket_size}_{self.gaussian_stddev}.sqlite3"
            self.SECONDS_IN_BUCKET = self.gaussian_bucket_size
        elif self.smoothing_method == "moving-average":
            self.DB = f"data/fitbit/processed/fitbit_data_moving_average_{self.moving_average_bucket_size}_{self.moving_average_window}.sqlite3"
            self.SECONDS_IN_BUCKET = self.moving_average_bucket_size
        else:
            raise Exception(f"Unknown method {self.smoothing_method}")

        self.init_base_tables()
        self.fitbit_importer = fitbit_importer

    def init_base_tables(self):
        if not os.path.exists("data"):
            os.mkdir("data")
        if not os.path.exists("data/fitbit"):
            os.mkdir("data/fitbit")
        if not os.path.exists("data/fitbit/processed"):
            os.mkdir("data/fitbit/processed")
        
        conn = sqlite3.connect(self.DB)

        cursor = conn.cursor()
        
        cursor.execute("CREATE TABLE IF NOT EXISTS hr_data (day int, weekday int, bucket int, interpolated_value int, value double)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hr_data_day ON hr_data (day)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hr_data_bucket ON hr_data (bucket)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hr_data_weekday ON hr_data (weekday)")

        cursor.execute("CREATE TABLE IF NOT EXISTS hr_data_finished (day int)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hr_data_finished_day ON hr_data_finished (day)")

        conn.commit()


    def get_finished_days(self):
        sql = "select day from hr_data_finished"

        conn = sqlite3.connect(self.DB)
        result = pd.read_sql_query(sql, conn).day.values.tolist()
        conn.close()

        return result


    def refresh_days(self, days):
        # Now check if we have already done this
        # If there are no missing days, we are finished right away!

        # Now see which days we need to process
        today = int(datetime.now().strftime("%Y%m%d"))

        # Delete all days in the future from the list
        days = [x for x in days if x <= today]

        # Determine which days we have already. Those should not be taken
        finished_days = self.get_finished_days()

        missing_days = [x for x in days if x not in finished_days]

        # if we are not finished, then 
        # make sure that  we have the raw days to back things up for the missing days
        # We have to add the surround days for this
        self.fitbit_importer.download_days(self.add_surround_days(missing_days))


        print(f"Missing processed days are {missing_days}")

        process_chunks = self.to_chunks(missing_days, 30)

        conn = sqlite3.connect(self.DB)
        cursor = conn.cursor()

        for process_chunk in process_chunks:
            process_chunk_with_surround = self.add_surround_days(process_chunk)

            df_raw_data = self.fitbit_importer.get_data(process_chunk_with_surround)

            if len(df_raw_data) > 0:
                # process the results

                if self.smoothing_method == "gaussian":
                    df_processed = self.process_days_gaussian(df_raw_data).loc[:, ["day", "weekday", "bucket", "interpolated_value", "value"]]
                else:
                    df_processed = self.process_days_moving_average(df_raw_data).loc[:, ["day", "weekday", "bucket", "interpolated_value", "value"]]

                # Now keep only the days that are actually relevant (i.e. remove all the surrounding days, we 
                # do not have to write those)
                df_processed = df_processed.loc[lambda x: x.day.isin(process_chunk), :]

                # and now we can write this to the database (except for today)
                print(f"Writing days {list(df_processed.day.unique())} to database")

                # Delete any of the existing days (should not be the case)
                # Just to be sure
                days_to_delete = '","'.join([str(x) for x in df_processed.day.unique()])

                cursor.execute(f'DELETE FROM hr_data where day in ("{days_to_delete}")')

                df_processed.to_sql('hr_data', conn, index=False, if_exists="append", chunksize=1000)

            # and also indicate we have finished writing the missing days
            # Because the day of today is not completely processed yet, we have to delete it from the list
            
            process_chunk = [x for x in process_chunk if x != today]

            if len(process_chunk) > 0:
                days_processed = '("' +  '"),("'.join([str(x) for x in process_chunk]) + '")'
                print(f"completely processed days: {days_processed}")
                cursor.execute(f'INSERT OR REPLACE INTO hr_data_finished ("day") VALUES {days_processed}')

        conn.commit()
        cursor.close()
        conn.close()



    def process_days_moving_average(self, df):
        # create the bucket based on the seconds
        # Calculate the median per bucket
        # Do a linear interpolation
        # Do a rolling average
        today = int(datetime.now().strftime("%Y%m%d"))
        max_seconds_today = df.loc[lambda x:x.day==today, "seconds"].max()
        max_bucket_today = self.SECONDS_IN_BUCKET * (max_seconds_today//self.SECONDS_IN_BUCKET)

        # Determine the max bucket if we are today

        # ensure all buckets are there for all of the days
        days = df.day.unique()
        buckets = [self.SECONDS_IN_BUCKET * x for x in range( (3600*24 -1)//self.SECONDS_IN_BUCKET) ]
        df_all = pd.DataFrame(data=itertools.product(days,buckets), columns=["day", "bucket"])
        df_all.loc[:, "day_bucket"] = df_all.day.astype(str) + df_all.bucket.astype(str)
        df_all.set_index("day_bucket", inplace=True)

        
        df.loc[:, "bucket"] = self.SECONDS_IN_BUCKET * (df.loc[:, "seconds"] // self.SECONDS_IN_BUCKET)
        df.loc[:, "day_bucket"] = df.day.astype(str) + df.bucket.astype(str)

        df = df_all.merge(df, how="left", left_index=True, right_on="day_bucket").drop("day_bucket", axis=1).rename(columns={"day_x":"day", "bucket_x":"bucket"}).sort_values(["day", "bucket"])

        df.loc[:, "interpolated_value"] = 0
        df.loc[df.value.isna(), "interpolated_value"] = 1

        df = df \
            .groupby(["day", "bucket"]) \
            .agg( {"value": "median", "interpolated_value": "max"}) \
            .reset_index() \
            .loc[:, ["day", "bucket", "interpolated_value", "value"]]


        df.loc[:, "value"] = df.loc[:, "value"].interpolate()
        df.loc[:, "value"] = df.loc[:, "value"].rolling(self.moving_average_window).mean()

        df.loc[:, "weekday"] = pd.to_datetime(df.day.astype(str), format="%Y%m%d").dt.weekday

        # Remove all buckets that are today after the last bucket we have for today
        df = df.loc[lambda x: ~((x.day==today) & (x.bucket > max_bucket_today)), :]

        return df


    def process_days_gaussian(self, df):
        # create the bucket based on the seconds
        # Calculate the median per bucket
        # Do a linear interpolation
        # Do a rolling average
        today = int(datetime.now().strftime("%Y%m%d"))
        max_seconds_today = df.loc[lambda x:x.day==today, "seconds"].max()
        max_bucket_today = self.SECONDS_IN_BUCKET * (max_seconds_today//self.SECONDS_IN_BUCKET)

        # Determine the max bucket if we are today

        # ensure all buckets are there for all of the days
        days = df.day.unique()
        buckets = [self.SECONDS_IN_BUCKET * x for x in range( (3600*24 -1)//self.SECONDS_IN_BUCKET) ]
        df_all = pd.DataFrame(data=itertools.product(days,buckets), columns=["day", "bucket"])
        df_all.loc[:, "day_bucket"] = df_all.day.astype(str) + df_all.bucket.astype(str)
        df_all.set_index("day_bucket", inplace=True)

        
        df.loc[:, "bucket"] = self.SECONDS_IN_BUCKET * (df.loc[:, "seconds"] // self.SECONDS_IN_BUCKET)
        df.loc[:, "day_bucket"] = df.day.astype(str) + df.bucket.astype(str)

        df = df_all.merge( df, how="left", left_index=True, right_on="day_bucket") \
            .drop("day_bucket", axis=1) \
            .rename(columns={"day_x":"day", "bucket_x":"bucket"}) \
            .sort_values(["day", "bucket"])


        df = df \
                .groupby(["day", "bucket"]) \
                .median() \
                .reset_index() \
                .loc[:, ["day", "bucket", "value"]]


        df.loc[:, "interpolated_value"] = 0
        df.loc[df.value.isna(), "interpolated_value"] = 1
        
        gauss_1D_kernel = Gaussian1DKernel(self.gaussian_stddev)
        df.loc[:, "value"] = convolve(df.loc[:, "value"], gauss_1D_kernel)
        df.loc[:, "value"] = df.loc[:, "value"].interpolate()

        df.loc[:, "weekday"] = pd.to_datetime(df.day.astype(str), format="%Y%m%d").dt.weekday

        # Remove all buckets that are today after the last bucket we have for today
        df = df.loc[lambda x: ~((x.day==today) & (x.bucket > max_bucket_today)), :]

        return df














    def to_chunks(self, l, n):
        for i in range( math.ceil( len(l)/ n ) ):
            yield l[i*n:((i+1)*n)]

    def get_day(self, day):
        conn = sqlite3.connect(self.DB)
        result = pd.read_sql_query(f"select * from hr_data where day='{day}' order by bucket", conn)
        conn.close()

        # We have to get rid of the initial interpolated values
        # and the tailing interpolated values
        if len(result) > 0:
            start_index = result.interpolated_value.loc[lambda x: x==0].index[0]
            end_index = result.interpolated_value.loc[lambda x: x==0].index[-1]

            result = result.loc[start_index:end_index, :]

        

        result.loc[:, 'hours_since_midnight'] = result.bucket / 3600
        result.drop( ['bucket', "interpolated_value"], axis=1, inplace=True)
   
        return result


    def get_range(self, range_start, range_end, percentiles=[0.5], weekday_filter=None):
        if not weekday_filter:
            weekday_filter = list(range(7))

        weekday_filter = [str(x) for x in weekday_filter]

        sql = f"select bucket,interpolated_value,value from hr_data where day >= '{range_start}' and day <= '{range_end}' and weekday in ({','.join(weekday_filter)}) order by day, bucket"
        conn = sqlite3.connect(self.DB)
        result = pd.read_sql_query(sql, conn)
        conn.close()


        # We have to get rid of the initial interpolated values
        # and the tailing interpolated values
        if len(result) > 0:
            start_index = result.interpolated_value.loc[lambda x: x==0].index[0]
            end_index = result.interpolated_value.loc[lambda x: x==0].index[-1]

            result = result.loc[start_index:end_index, :]

        result.loc[:, 'hours_since_midnight'] = result.bucket / 3600
        result.drop( ['bucket', "interpolated_value"], axis=1, inplace=True)


        # Force the value column to be float
        result.loc[:, 'value'] = result.loc[:, 'value'].astype(float)

        result = result.groupby("hours_since_midnight").quantile(percentiles).unstack(level=-1).droplevel(0, axis=1)


        result.columns = list(range(len(result.columns)))

        return result


    def to_chunks(self, l, n):
        for i in range(1 + len(l) // n):
            yield l[i*n:((i+1)*n)]

    def add_surround_days(self, days):
        day_earlier = [int((pd.to_datetime(str(x), format="%Y%m%d") - pd.to_timedelta(1, "day")).strftime("%Y%m%d")) for x in days]
        day_after = [int((pd.to_datetime(str(x), format="%Y%m%d") + pd.to_timedelta(1, "day")).strftime("%Y%m%d")) for x in days]
        result = sorted(list(set( day_after + day_earlier + days)))

        return result
