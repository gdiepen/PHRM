import sqlite3
import math
import pandas as pd
from datetime import datetime
from .fitbit.datastore import FitbitStore

class Store:
    def __init__(self, CLIENT_ID, CLIENT_SECRET):
        self.CLIENT_ID = CLIENT_ID
        self.CLIENT_SECRET = CLIENT_SECRET

        self.fitbitDatastores = {}

    def _get_datastore(self, settings):
        key = None

        if settings["smoothing_method"] == "gaussian":
            key = ("gaussian", settings["gaussian_bucket_size"], settings["gaussian_stddev"])

        if settings["smoothing_method"] == "moving-average":
            key = ("moving-average", settings["moving_average_bucket_size"], settings["moving_average_window"])

        if key is None:
            raise Exception(f"Unsupported smoothing method {settings['smoothing_method']}")


        _fb_datastore = self.fitbitDatastores.get(key, FitbitStore(self.CLIENT_ID, self.CLIENT_SECRET, settings))

        self.fitbitDatastores[key] = _fb_datastore

        return _fb_datastore


    def refresh_data(self, days, settings):
        _fb_datastore = self._get_datastore(settings)
        _fb_datastore.refresh_days(days)

    def get_day(self, day, settings):
        _fb_datastore = self._get_datastore(settings)
        return _fb_datastore.get_day(day)

    def get_range(self, range_start_day, range_end_day, range_percentiles, range_weekday_filter, settings):
        _fb_datastore = self._get_datastore(settings)
        return _fb_datastore.get_range(range_start_day, range_end_day, range_percentiles, range_weekday_filter)
