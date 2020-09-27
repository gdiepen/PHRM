import pprint
from flask import Flask, redirect, request, jsonify
import logging
import os
import yaml

from phrm.data.store import Store
import pandas as pd






from datetime import datetime


app = Flask(__name__)

with open("../credentials.yaml") as f:
    config = yaml.safe_load(f)


datastore = Store(config["CLIENT_ID"], config["CLIENT_SECRET"])

@app.after_request
def add_header(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response



@app.route('/api/refresh_data', methods=['POST'])
def refresh_data():
    content = request.json

    print(content)

    if content.get("date_range_start", None) is not None:
        range_start = datetime.strptime(str(content["date_range_start"]), "%Y%m%d").strftime("%Y-%m-%d")
        range_end = datetime.strptime(str(content["date_range_end"]), "%Y%m%d").strftime("%Y-%m-%d")
        datastore.refresh_data(range_start, range_end)
    
    if content.get("separate_dates", None) is not None:
        dates = [datetime.strptime(str(x), "%Y%m%d").strftime("%Y-%m-%d") for x in content["separate_dates"]]
        datastore.ensure_data(dates)


    return jsonify({'status': '0'})


@app.route('/api/quantiles/<int:year_month_day_start>/<int:year_month_day_end>', methods=['GET'])
def get_data_quantile(year_month_day_start, year_month_day_end):
    bucket_size = int(request.args.get('bucket_size', 10))
    rolling_average_number_periods = int(request.args.get('rolling_average_number_periods', 15))

    interval = float(request.args.get('interval', 0.90))

    arg_relevant_week_days = request.args.get('weekday', ','.join(map(str, range(0,7) )))
    if arg_relevant_week_days == "":
        arg_relevant_week_days = ','.join(map(str, range(0,7) ))
    print(arg_relevant_week_days)

    arg_relevant_week_days = [int(x) for x in arg_relevant_week_days.split(",")]

    print('Request for all quantile data ({}) from {} to {} for weekdays {} for bucket size {} and rolling average {}'.format( interval, year_month_day_start, year_month_day_end, arg_relevant_week_days, bucket_size, rolling_average_number_periods))

    year_month_day_start = datetime.strptime(str(year_month_day_start), "%Y%m%d").strftime("%Y-%m-%d")
    year_month_day_end = datetime.strptime(str(year_month_day_end), "%Y%m%d").strftime("%Y-%m-%d")

    (a_m, a_h, a_l) = datastore.get_range(year_month_day_start, year_month_day_end, interval, arg_relevant_week_days)

    my_df = pd.DataFrame( {'low': a_l, 'median': a_m , 'high': a_h} )

    return my_df.reset_index().to_json(orient='records')


@app.route('/api/day/<int:year_month_day>', methods=['GET'])
def get_data_day(year_month_day):
    str_year_month_day = datetime.strptime(str(year_month_day), "%Y%m%d").strftime("%Y-%m-%d")
    
    result = datastore.get_daily_data(str_year_month_day).loc[:, ['hours_since_midnight', 'value']]

    return result.to_json(orient='records')


if __name__ == '__main__':

    app.run(debug=True, host='0.0.0.0', port=5002)

