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


datastore = Store()

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

    datastore.refresh_data("fitbit", all_dates, content)

    return jsonify({'status': '0'})

# @app.route("/api/fitbit_auth_redirect", methods=["GET"])
# def fitbit_auth_redirect():
#     datastore.oauth2_token(_state, _code)
# 
#     return redirect("/")
# 

@app.route("/api/auth_config_url", methods=["GET"])
def auth_config_url():
    # Currently only fitbit backend implemented, so just get the auth config URL for the
    # fitbit backend
    return jsonify({"auth_config_url": datastore.auth_config_url("fitbit")})
    

@app.route('/api/quantiles/<int:year_month_day_start>/<int:year_month_day_end>', methods=['GET'])
def get_data_quantile(year_month_day_start, year_month_day_end):
    percentiles = [float(x) for x in request.args.getlist('range_percentiles')]
    arg_relevant_week_days = request.args.get('range_relevant_weekdays', ','.join(map(str, range(0,7) )))
    if arg_relevant_week_days == "":
        arg_relevant_week_days = ','.join(map(str, range(0,7) ))

    arg_relevant_week_days = [int(x) for x in arg_relevant_week_days.split(",")]

    print('Request for all quantile data ({}) from {} to {} for weekdays {}'.format( percentiles, year_month_day_start, year_month_day_end, arg_relevant_week_days))

    all_percentiles = datastore.get_range("fitbit", year_month_day_start, year_month_day_end, percentiles, arg_relevant_week_days, request.args)


    #my_df = pd.DataFrame( {'low': all_percentiles.iloc[:,0], 'median': all_percentiles.iloc[:,1], 'high': all_percentiles.iloc[:, 2]} )

    #return my_df.reset_index().to_json(orient='records')
    return all_percentiles.reset_index().to_json(orient='records')


@app.route('/api/day/<int:year_month_day>', methods=['GET'])
def get_data_day(year_month_day):


    result = datastore.get_day("fitbit", year_month_day, request.args).loc[:, ['hours_since_midnight', 'value']]

    return result.to_json(orient='records')


if __name__ == '__main__':
    for r,f in datastore.get_backend_routes():
        print(f"Adding {f} to handle route {r}")
        app.add_url_rule(r, view_func=f, methods=["GET"])

    app.run(debug=True, host='0.0.0.0', port=5002)

