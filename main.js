// var _ = require("underscore")._;
import rp from 'request-promise';
// var getData = require("./req.js");
require('shelljs/global');
// var deferred = require('q').defer();

async function doPhantom () {
    let res = await rp('http://json.diao.li/getjson/58b519f1d296dc3b050d8ff9');
    res = JSON.parse(res);
    const rtn = res.rtn;
    const data = res.data;
    if (!which('phantomjs')) {
        echo('Sorry, this script requires phantomjs');
        exit(1);
    }
    console.log(res);
    if (rtn === 0) {
        data.forEach(async item => {
            const child = await new Promise((resolve, reject) => {
                exec('node monitor.js ' + item.url, (code, stdout, stderr) => {
                    resolve(stdout);
                });
            });
        });
    }
}
doPhantom();

// request('http://json.diao.li/getjson/58b519f1d296dc3b050d8ff9', function (error, response, body) {
//     if(!error){
//        dataList = JSON.parse(body);
//        if(dataList.rtn == 0){
//            console.log(dataList.data.length);
//            _.each(dataList.data, function(item){
//                 console.log('#############');
//                 if (!which('phantomjs')) {
//                     echo('Sorry, this script requires phantomjs');
//                     exit(1);
//                 }
//                 console.log(item.url);
//                 var child = exec('phantomjs netsniff.js ' + item.url, {async:true});
//                 child.stdout.on('data', function(data) {
//                    console.log(data);
//                 });
//            });
//        }
//     }else{
//         deferred.reject(err);
//     }
// });

// function report(urlList){
//     //json.diao.li/getjson/58b777b5d296dc3b050d8ffd
//     request.post({url:'http://json.diao.li/getjson/58b777b5d296dc3b050d8ffd', url: urlList}, function optionalCallback(err, httpResponse, body) {
//     if (err) {
//         return console.error('upload failed:', err);
//     }
//     console.log('Upload successful!  Server responded with:', body);
//     });
// }