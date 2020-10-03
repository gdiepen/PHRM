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
    print("handling /api/refresh_data")
    pprint.pprint(content)


    all_dates = []

    if content.get("range_start_day", None) is not None:
        range_start = str(content["range_start_day"])
        range_end = str(content["range_end_day"])

        all_dates.extend(pd.date_range(range_start, range_end, freq="D").strftime("%Y%m%d").astype(int).tolist())
    
    if content.get("separate_dates", None) is not None:
        all_dates.extend([int(x) for x in content["separate_dates"]])

    # Now get the unique sorted list again
    all_dates = sorted([*{*all_dates}])

    datastore.refresh_data(all_dates, content)

    return jsonify({'status': '0'})


@app.route('/api/quantiles/<int:year_month_day_start>/<int:year_month_day_end>', methods=['GET'])
def get_data_quantile(year_month_day_start, year_month_day_end):
    
    interval = float(request.args.get('range_interval', 0.90))

    arg_relevant_week_days = request.args.get('range_relevant_weekdays', ','.join(map(str, range(0,7) )))
    if arg_relevant_week_days == "":
        arg_relevant_week_days = ','.join(map(str, range(0,7) ))

    arg_relevant_week_days = [int(x) for x in arg_relevant_week_days.split(",")]

    print('Request for all quantile data ({}) from {} to {} for weekdays {}'.format( interval, year_month_day_start, year_month_day_end, arg_relevant_week_days))

    (a_m, a_h, a_l) = datastore.get_range(year_month_day_start, year_month_day_end, interval, arg_relevant_week_days, request.args)

    my_df = pd.DataFrame( {'low': a_l, 'median': a_m , 'high': a_h} )

    return my_df.reset_index().to_json(orient='records')


@app.route('/api/day/<int:year_month_day>', methods=['GET'])
def get_data_day(year_month_day):


    result = datastore.get_day(year_month_day, request.args).loc[:, ['hours_since_midnight', 'value']]

    return result.to_json(orient='records')


if __name__ == '__main__':

    app.run(debug=True, host='0.0.0.0', port=5002)

