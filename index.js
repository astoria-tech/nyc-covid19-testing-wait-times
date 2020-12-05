const moment = require("moment");

const crawler = require('crawler-request');
const parse = require('csv-parse/lib/sync')
const fs = require('fs');
const ObjectsToCsv = require('objects-to-csv');

let data = null;
try {
    data = fs.readFileSync('wait-times.csv', 'utf8');
} catch (e) {
    console.error('Error reading csv');
}
const waitTimes = parse(data, {
    columns: true,
    skip_empty_lines: true
})
let prevLine = '';
let done = false;
let blockEnded = true;
let clinicInProgress = true;
const emptyWaitTime = {'clinic': null, 'date': null, 'reported_time_unix': null, 'reported_time_human': null, 'wait_time_minutes': null};
const date = new Date();
const currentDate = date.toLocaleDateString("en-US");
crawler("https://hhinternet.blob.core.windows.net/wait-times/testing-wait-times.pdf").then(function (response) {
    let waitTime = {}
    response.text.split('\n').forEach(line => {
        if (!line.length || done) return;
        done = line.indexOf('*Asterisk indicates wait time may have changed since last reported.') !== -1
        if (done) return;
        console.log(line);
        if (clinicInProgress) {
            if (blockEnded) {
                waitTime = {
                    ...emptyWaitTime,
                    'clinic': line,
                    'date': currentDate
                }
            }
            if (line.indexOf('Last Reported Time:') !== -1) {
                blockEnded = true;
                let reportedTime = line.replace('Last Reported Time: ', '').trim()
                let reportedTimeUnix = null;
                if (reportedTime.length) {
                    reportedTimeUnix = moment(reportedTime, 'h:mm A').unix();
                }
                waitTime['reported_time_unix'] = reportedTimeUnix;
                waitTime['reported_time_human'] = reportedTime;
                if (waitTime['wait_time_minutes'] !== null) {
                    waitTimes.push(waitTime)
                }
            } else {
                blockEnded = false;
                let currentWaitTime = null;
                if (line.indexOf('No Wait Time') !== -1) {
                    currentWaitTime = 0;
                } else if (line.indexOf('0-30 Minutes') !== -1) {
                    currentWaitTime = 30;
                } else if (line.indexOf('30-60 Minutes') !== -1) {
                    currentWaitTime = 60;
                } else if (line.indexOf('1-1.5 Hours') !== -1) {
                    currentWaitTime = 90;
                } else if (line.indexOf('1.5-2 Hours') !== -1) {
                    currentWaitTime = 120;
                } else if (line.indexOf('2-2.5 Hours') !== -1) {
                    currentWaitTime = 150;
                } else if (line.indexOf('2.5-3 Hours') !== -1) {
                    currentWaitTime = 180;
                } else if (line.indexOf('3-3.5 Hours') !== -1) {
                    currentWaitTime = 210;
                } else if (line.indexOf('3.5-4 Hours') !== -1) {
                    currentWaitTime = 240;
                }
                waitTime['wait_time_minutes'] = currentWaitTime;
            }
        }
        prevLine = line;
    })
    console.log(waitTimes);
    (async () => {
        const csv = new ObjectsToCsv(waitTimes);

        // Save to file:
        await csv.toDisk('./wait-times.csv');

        // Return the CSV file as string:
        console.log(await csv.toString());
    })();
});
