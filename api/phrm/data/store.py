import sqlite3
import math
import pandas as pd
from datetime import datetime
from .fitbit.datastore2 import FitbitStore2

class Store:
    def __init__(self, CLIENT_ID, CLIENT_SECRET):
        self.CLIENT_ID = CLIENT_ID
        self.CLIENT_SECRET = CLIENT_SECRET

        self.fitbitDatastore = FitbitStore2(self.CLIENT_ID, self.CLIENT_SECRET)

    def refresh_data(self, days):
        self.fitbitDatastore.refresh_days(days)

    def get_day(self, day):
        return self.fitbitDatastore.get_day(day)

    def get_range(self, range_start, range_end, interval=0.6, weekday_filter=None):
        return self.fitbitDatastore.get_range(range_start, range_end, interval, weekday_filter)
