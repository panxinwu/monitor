const phantom = require('phantom'),
    events = require('events'),
    system = require('system'),
    fs = require('fs'),
    dataList = [],
    winston = require('winston'),
    schedule = require('node-schedule'),
    rule = new schedule.RecurrenceRule();
rule.second = [0];
let pageTitle = '',
    pageResource = [],
    pageStartTime = '',
    har = {};

import rp from 'request-promise';
require('shelljs/global');

winston.configure({
    transports: [
        new (winston.transports.File)({ filename: 'logInfo.log' })
    ]
});

async function doPhantom() {
    let res = await rp('http://json.diao.li/getjson/58b519f1d296dc3b050d8ff9');
    res = JSON.parse(res);
    const rtn = res.rtn,
        emitter = new events.EventEmitter(),
        data = res.data;
    if (!which('phantomjs')) {
        echo('Sorry, this script requires phantomjs');
        exit(1);
    }
    if (rtn === 0) {
        data.forEach(async item => {
            const child = await new Promise((resolve, reject) => {
                (async function (item) {
                    function createHAR(address, title, startTime, resources) {
                        let entries = [];
                        resources.forEach(function (resource) {
                            let request = resource.request,
                                startReply = resource.startReply,
                                endReply = resource.endReply;

                            if (!request || !startReply || !endReply) {
                                return;
                            }

                            if (request.url.match(/(^data:image\/.*)/i)) {
                                return;
                            }
                            entries.push({
                                startedDateTime: request.time,
                                time: endReply.time - request.time,
                                request: {
                                    method: request.method,
                                    url: request.url,
                                    httpVersion: "HTTP/1.1",
                                    cookies: [],
                                    headers: request.headers,
                                    queryString: [],
                                    headersSize: -1,
                                    bodySize: -1
                                },
                                response: {
                                    status: endReply.status,
                                    statusText: endReply.statusText,
                                    httpVersion: "HTTP/1.1",
                                    cookies: [],
                                    headers: endReply.headers,
                                    redirectURL: "",
                                    headersSize: -1,
                                    bodySize: startReply.bodySize,
                                    content: {
                                        size: startReply.bodySize,
                                        mimeType: endReply.contentType
                                    }
                                },
                                cache: {},
                                timings: {
                                    blocked: 0,
                                    dns: -1,
                                    connect: -1,
                                    send: 0,
                                    wait: startReply.time - request.time,
                                    receive: endReply.time - startReply.time,
                                    ssl: -1
                                },
                                pageref: address
                            });
                        });

                        return {
                            log: {
                                version: '1.2',
                                creator: {
                                    name: "PhantomJS"
                                },
                                pages: [{
                                    startedDateTime: startTime.toISOString(),
                                    id: address,
                                    title: title,
                                    pageTimings: {
                                        onLoad: page.endTime - page.startTime
                                    }
                                }],
                                entries: entries
                            }
                        };
                    }

                    const instance = await phantom.create();
                    const page = await instance.createPage();

                    await page.property('viewportSize', { width: 1280, height: 1000 });
                    await page.on("onConsoleMessage", function (msg) {
                        if (/^title/g.test(msg)) {
                            pageTitle = msg.split(':')[1];
                        }
                        console.log('info', msg);
                    });
                    await page.on('onLoadStarted', function () {
                        pageStartTime = new Date();
                    });
                    const status = await page.open(item.url);
                    const content = await page.property('content');

                    let outObj = instance.createOutObject();
                    outObj.pageResource = [];
                    outObj.pageRecieved = [];

                    await page.on('onCallback', async function (data) {
                        switch (data) {
                            case 1:
                                await emitter.emit('operateEnd', "加载完毕");
                                await instance.exit();
                                break;
                        }
                    });
                    //纯浏览器沙盒状态
                    await page.includeJs("http://www.promisejs.org/polyfills/promise-6.1.0.js");
                    await page.evaluateAsync(function (operateList) {
                        console.log('title:' + document.title);
                        var heightPos = 0;
                        const dtd = new $.Deferred();

                        var scrollClock = setInterval(function () {
                            if (heightPos <= $(document).height()) {
                                heightPos += 100;
                                window.document.body.scrollTop = heightPos;
                            } else {
                                dtd.resolve();
                            }
                        }, 400);
                        $.when(dtd).then(function () {
                            // console.info('scrollEnd'); 
                            clearInterval(scrollClock);
                        }).then(function () {
                            var operateClock = [];
                            var pList = [];
                            console.log(operateList.list.length);
                            for (var i = 0; i < operateList.list.length; i++) {
                                pList[i] = (function (i) {
                                    return new Promise(function (resolve, reject) {
                                        operateClock[i] = null;
                                        if (operateList.list[i].operateType === 'click') {
                                            var j = 0,
                                                $domObj = $(operateList.list[i].queryName);
                                            operateClock[i] = setInterval(function () {
                                                for (var k = 0; k < $domObj.length; k++) {
                                                    console.log('click', operateList.list[i].queryName, '第', i + 1, '个操作     第', j + 1, '次点击    第', k + 1, '个元素');
                                                    $($domObj[k]).click();
                                                }
                                                j++;
                                                if (j >= operateList.list[i].clkNum) {
                                                    console.log('点击完毕');
                                                    clearInterval(operateClock[i]);
                                                    resolve();
                                                }
                                            }, 400);
                                        } else if (operateList.list[i].operateType === 'mouseover') {
                                            var j = 0,
                                                $domObj = $(operateList.list[i].queryName);
                                            operateClock[i] = setInterval(function () {
                                                console.log('mouseover', operateList.list[i].queryName, '第', i, '个操作     第', j, '个元素');
                                                if (j >= $domObj.length) {
                                                    clearInterval(operateClock[i]);
                                                    resolve();
                                                }
                                                $($domObj[j]).mouseover();
                                                j++;
                                            }, 400);
                                        }
                                    })
                                })(i);//end of promise
                            };
                            Promise.all(pList).then(values => {
                                setTimeout(function(){
                                    window.callPhantom(1);//回调退出当前phantom子进程
                                }, 400);
                            });
                        });
                    }, 0, item);//将定制数据传入沙盒

                    page.on('onResourceRequested', function (req, net, out) {
                        out.pageResource[req.id] = {
                            request: req,
                            startReply: null,
                            endReply: null
                        };
                    }, outObj);
                    page.on('onResourceReceived', function (res, outObj) {
                        outObj.pageResource[res.id] = outObj.pageResource[res.id] || {};
                        if (res.stage === 'start') {
                            outObj.pageResource[res.id].startReply = res;
                        }
                        if (res.stage === 'end') {
                            outObj.pageResource[res.id].endReply = res;
                        }
                    }, outObj);

                    emitter.on('operateEnd', function (data) {
                        har = createHAR(item.url, pageTitle, pageStartTime, outObj.pageResource);
                        const reg = /^image/g;
                        let isImageValue,
                            imageSizeValue,
                            imageUrl,
                            testImg = [],
                            isImage,
                            badImageNum = 0,
                            badImage = [];
                            console.log('har.log.entries.length', har.log.entries.length);
                        for (let i = 0; i < har.log.entries.length; i++) {
                            isImageValue = har.log.entries[i].response.headers[2].value;
                            imageSizeValue = har.log.entries[i].response.headers[3].value;
                            imageUrl = har.log.entries[i].request.url;
                            isImage = reg.test(isImageValue);
                            reg.test(isImageValue);//这里必须执行一下，才能遍历所有的值？
                            if (isImage) {
                                 //检测图片是否符合尺寸规则
                                var b2kb = imageSizeValue/1024;
                                if(b2kb >= 40){
                                    console.info('size::::::',b2kb,'!!!!!!!!!!!!!!!!!!!!!!',imageUrl);
                                    testImg[badImageNum] =  (function(badImage,imageUrl,b2kb){
                                        return rp(imageUrl + '!imginfo').then(function(imgRes){
                                            imgRes = JSON.parse(imgRes);
                                            console.log(imgRes.width);
                                            console.log(imgRes.height);
                                            console.log(b2kb);
                                                if((imgRes.width >= 600 || imgRes.height >= 600) && b2kb >=150){
                                                    badImage[badImageNum] = imgRes;
                                                    badImage[badImageNum].url = imageUrl;
                                                }else if((imgRes.width >= 400 || imgRes.height >= 400) && b2kb >=100){
                                                    badImage[badImageNum] = imgRes;
                                                    badImage[badImageNum].url = imageUrl;
                                                }else if((imgRes.width >= 200 || imgRes.height >= 200) && b2kb >=40){
                                                    badImage[badImageNum] = imgRes;
                                                    badImage[badImageNum].url = imageUrl;
                                                }
                                                badImageNum++;
                                                resolve();
                                        }).catch(function(err){
                                        });
                                    })(badImage,imageUrl,b2kb);
                                }//end of if
                            }
                        }//end of for
                        Promise.all(testImg).then(function(){
                            console.log('#############');
                            winston.info(badImage);
                        });
                    });
                }(item));
            });
        });
    }
}




// let j = schedule.scheduleJob(rule, function(){
//     winston.log('定时任务启动');
//     doPhantom();
// });
// setInterval(function(){
    doPhantom();
// }, 120000);







