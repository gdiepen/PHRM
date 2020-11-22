import sqlite3
import math
import pandas as pd
from datetime import datetime
from phrm.data.fitbit.store import FitbitStore

class Store:
    def __init__(self):
        self.data_stores = {
            "fitbit": FitbitStore()
        }

    def refresh_data(self, backend, days, settings):
        self.data_stores[backend].refresh_data(days, settings)

    def get_day(self, backend, day, settings):
        return self.data_stores[backend].get_day(day, settings)

    def get_range(self, backend, range_start_day, range_end_day, range_percentiles, range_weekday_filter, settings):
        return self.data_stores[backend].get_range(range_start_day, range_end_day, range_percentiles, range_weekday_filter, settings)

    def get_backend_routes(self):
        backend_routes = []
        for k,v in self.data_stores.items():
            backend_routes.extend(v.get_backend_routes(prefix="/api/"))
        return backend_routes

    def auth_config_url(self, backend):
        return self.data_stores[backend].get_auth_config_url()
