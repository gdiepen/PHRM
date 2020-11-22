
from flask import request
from phrm.data.fitbit.processed_datastore import FitbitProcessedDataStore 
from phrm.data.fitbit.importer import  FitbitImporter
import yaml


class FitbitStore:
    def __init__(self):
        self.processed_data_stores = {}

        self.fitbit_importer = FitbitImporter()



    def _get_data_store(self, settings):
        key = None

        if settings["smoothing_method"] == "gaussian":
            key = ("gaussian", settings["gaussian_bucket_size"], settings["gaussian_stddev"])

        if settings["smoothing_method"] == "moving-average":
            key = ("moving-average", settings["moving_average_bucket_size"], settings["moving_average_window"])

        if key is None:
            raise Exception(f"Unsupported smoothing method {settings['smoothing_method']}")


        _fb_data_store = self.processed_data_stores.get(key, FitbitProcessedDataStore(self.fitbit_importer, settings))

        self.processed_data_stores[key] = _fb_data_store

        return _fb_data_store


    def refresh_data(self, days, settings):
        _fb_data_store = self._get_data_store(settings)
        _fb_data_store.refresh_days(days)

    def get_day(self, day, settings):
        _fb_data_store = self._get_data_store(settings)
        return _fb_data_store.get_day(day)

    def get_range(self, range_start_day, range_end_day, range_percentiles, range_weekday_filter, settings):
        _fb_data_store = self._get_data_store(settings)
        return _fb_data_store.get_range(range_start_day, range_end_day, range_percentiles, range_weekday_filter)

    def get_backend_routes(self, prefix):
        return [(f"{prefix}fitbit_auth_redirect", self.fitbit_importer.oauth2_token)]

    def get_auth_config_url(self):
        print(f"aaaa = {self.fitbit_importer.is_authenticated}")
        if self.fitbit_importer.is_authenticated:
            return ""
        else:
            return self.fitbit_importer.fitbit.client.authorize_token_url()[0]

