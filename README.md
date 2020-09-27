# Personal Heart Rate Monitor (PHRM)

Since the beginning of 2020, I got myself a Fitbit Charge 3 that monitors my heart-rate 24/7. Since it was possible to access this data, I decided to write an application to visualize the data.

The main idea for the application is to be able to see how the heart rate for a given day compares to the median + given percentiles over a certain range.
![screenshot](documentation/img/screenshot_phrm_daily_heartrate.png)


Besides this visualization, I also want to add comparison of medians of different ranges (allows you to compare different ranges of time)


Most important is that this application is a very good playground for me to work on both the backend application in Python (using Flask) and a frontend HTML/CSS/JS website using D3. Instead of using the flask static or template folder, I opted for using a separate application that is bundled using webpack
