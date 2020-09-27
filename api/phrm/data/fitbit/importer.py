import fitbit
import pandas as pd
import sqlite3
from datetime import datetime
import os
import pickle

from . import gather_keys_oauth2 as Oauth2


class Importer:
    def __init__(self, CLIENT_ID, CLIENT_SECRET):
        self.CLIENT_ID = CLIENT_ID
        self.CLIENT_SECRET = CLIENT_SECRET
        self.data_cache = {}
        

    def convert_to_buckets(self, df, day):
        SECONDS_IN_BUCKET = 60

        midnight_str = "{} 00:00:00".format(day)
        midnight = pd.to_datetime(midnight_str, format="%Y-%m-%d %H:%M:%S", errors="coerce")

        df.loc[:, "date"] = day
        df.loc[:, "date_time"] = pd.to_datetime(df.date + ' ' + df.time, format="%Y-%m-%d %H:%M:%S", errors="coerce")
        df.loc[:, "bucket"] = (df.date_time.astype("int64")//1e9 - midnight.timestamp()) // SECONDS_IN_BUCKET
        df.loc[:, "datetime_bucket"] = midnight + pd.to_timedelta(SECONDS_IN_BUCKET * df.bucket, "sec")

        df = df.groupby("datetime_bucket")[["value"]].mean()

        day_range_index_end =  f"{day} 23:59:59"
        # In case we are looking at today, make sure that we don't let it run till the end of the day, but only
        # till the bucket that we have
        if datetime.now().strftime("%Y-%m-%d %H:%M:%S") < day_range_index_end:
            bucket = (float((pd.to_datetime(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), format="%Y-%m-%d %H:%M:%S")).asm8)//1e9 - midnight.timestamp())//SECONDS_IN_BUCKET
            now_bucket = midnight + pd.to_timedelta(SECONDS_IN_BUCKET * bucket, "sec")

            day_range_index_end = now_bucket.strftime("%Y-%m-%d %H:%M:%S")

        day_range_index = pd.date_range("{} 00:00:00".format(day), day_range_index_end, freq="{}S".format(SECONDS_IN_BUCKET))

        df = df.reindex(day_range_index)

        df.loc[:, "bucket"] = ((df.index.astype("int64")//1e9 - midnight.timestamp()) // SECONDS_IN_BUCKET).astype(int)

        df.loc[:, "day"] = df.index.strftime("%Y-%m-%d")
        df.loc[:, "weekday"] = df.index.weekday

        return df

    def calculate_rolling_average(self, df):
        ROLLING_AVERAGE_WINDOW=10

        # First we interpolate all missing values
        df.loc[:, "interpolated"] = df.loc[:, "value"].interpolate()

        # Now calculate the rolling average
        df.loc[:, "value"] = df.loc[:, "interpolated"].rolling(ROLLING_AVERAGE_WINDOW).mean()

        df.drop("interpolated", axis=1, inplace=True)

        return df



    def to_chunks(self, l, n):
        for i in range(1 + len(l) // n):
            yield l[i*n:((i+1)*n)]

    def add_before_days(self, days):
        day_earlier = [(pd.to_datetime(x, format="%Y-%m-%d") - pd.to_timedelta(1, "day")).strftime("%Y-%m-%d") for x in days]
        result = sorted(list(set( day_earlier + days)))

        return result

    def retrieve_processed_data(self, days):
        """Function to import a given set of days from fitbit. This function will then
        download all of the required days (i.e. also the day before one of the 
        """
        
        print(f"Days {days}")
        # We need to always have one day earlier for the days we are going to download
        # because of the linear fill and moving average
        days_to_download = self.add_before_days(days)
        print(f"Days to download {days_to_download}")

        # delete anything from the cache that we don't need anymore
        required_days = self.add_before_days(days)

        days_to_delete_from_cache = [x for x in self.data_cache.keys() if x not in required_days]
        for d in days_to_delete_from_cache:
            print(f"Deleting day {d} from cache")
            del self.data_cache[d]

        for day in required_days:
            # If the day was not yet downloaded
            if day not in self.data_cache.keys():
                print(f"Downloading day {day} from fitbit")
                raw_data = self.get_raw_hr_data(day)
                if len(raw_data):
                    self.data_cache[day] = self.convert_to_buckets(raw_data, day)
                else:
                    print(f"Day {day} does not have any data")
            else:
                print(f"Took day {day} from cache")

        if len(self.data_cache.keys()) == 0:
            return None

        # Now combine the dataframes into one large dataframe        
        combined_df = pd.concat(self.data_cache.values(), axis=0)

        # Now calculate the rolling average
        combined_df = self.calculate_rolling_average(combined_df)

        # Before we continue, make sure that we delete today from the cache, as it might contain partial data only
        # and we should not keep that 
        if datetime.now().strftime("%Y-%m-%d") in self.data_cache.keys():
            del self.data_cache[datetime.now().strftime("%Y-%m-%d")]


        # Now filter only the relevant days (i.e. don't write the previous day again)
        combined_df = combined_df.loc[combined_df.day.isin(days), :]
        return combined_df

    def refresh_cb(self, token):
        """ Called when the OAuth token has been refreshed """
        print("Refreshing tokens")
        access_token = token['access_token']
        refresh_token = token['refresh_token']
        expires_at = token['expires_at']

        with open('token.pickle', 'wb') as f:
            pickle.dump(token, f)


    def obtain_tokens(self):
        if not os.path.exists('token.pickle'):
            server = Oauth2.OAuth2Server(self.CLIENT_ID, self.CLIENT_SECRET)
            server.browser_authorize()

            with open('token.pickle', 'wb') as f:
                pprint.pprint(server.fitbit.client.session.token)
                pickle.dump(server.fitbit.client.session.token, f)

    def get_raw_hr_data(self, day):
        """Retrieve the raw HR data for a given day from fitbit

        Args:
            day:
              String representing the day we wan to get. The string should be formatted in
              the format YYYY-MM-DD
        """
        
        
        self.obtain_tokens()
        
        print("Retrieving heart-rate data for day {} from fitbit API".format(day))
        with open('token.pickle', 'rb') as f:
            token = pickle.load(f)

            ACCESS_TOKEN = str(token['access_token'])
            REFRESH_TOKEN = str(token['refresh_token'])
            EXPIRES_AT = float(str(token['expires_at']))


        auth2_client = fitbit.Fitbit(
            self.CLIENT_ID,
            self.CLIENT_SECRET,
            oauth2=True,
            access_token=ACCESS_TOKEN,
            refresh_token=REFRESH_TOKEN,
            expires_at=EXPIRES_AT,
            refresh_cb=self.refresh_cb
        )


        fb_data = auth2_client.intraday_time_series('activities/heart', base_date=day, detail_level='1sec')

        df_hr_data = pd.DataFrame(fb_data['activities-heart-intraday']['dataset']) 

        return df_hr_data     
