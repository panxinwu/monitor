import rp from 'request-promise';
require('shelljs/global');
const winston = require('winston');
      

const schedule = require('node-schedule');

const rule = new schedule.RecurrenceRule();
    rule.minute = [0,30];
winston.configure({
    transports: [
        new (winston.transports.File)({ filename: 'logInfo.log' })
    ]
});
async function doPhantom () {
    let res = await rp('http://json.diao.li/getjson/58b519f1d296dc3b050d8ff9');
        res = JSON.parse(res);
    const rtn = res.rtn;
    const data = res.data;
    if (!which('phantomjs')) {
        echo('Sorry, this script requires phantomjs');
        exit(1);
    }
    winston.log(res);
    if (rtn === 0) {
        data.forEach(async item => {
            const child = await new Promise((resolve, reject) => {
                console.log(item);
            });
        });
    }
}

let j = schedule.scheduleJob(rule, function(){
    winston.log('定时任务启动');
    // doPhantom();
});
    doPhantom();

