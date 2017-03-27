const   phantom = require('phantom'),
        events = require('events'),
        system = require('system'),
        fs = require('fs'),
        winston = require('winston');

let     pageTitle = '',
        pageResource = [],
        pageStartTime = '',
        queryElemList = [];
import rp from 'request-promise';
require('shelljs/global');

winston.configure({
    transports: [
        new (winston.transports.File)({ filename: 'logInfo.log' })
    ]
});

async function doPhantom() {
    let res = await rp('http://aotu.jd.com/monitor/api/common/materials');
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
                    const filterData = require('./lib/filterData');
                    const instance = await phantom.create();
                    const page = await instance.createPage();
                    await page.property('viewportSize', { width: 1280, height: 1000 });
                    await page.on("onConsoleMessage", function (msg) {
                        if (/^title/g.test(msg)) {
                            pageTitle = msg.split(':')[1];
                        }
                        if (/^queryElemList:/g.test(msg)) {
                            queryElemList = JSON.parse(msg.split('queryElemList:')[1]);
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
                                // await instance.exit();
                                break;
                        }
                    });
                    //纯浏览器沙盒状态
                    await page.includeJs("https://www.promisejs.org/polyfills/promise-6.1.0.js");
                    await page.evaluateAsync(function (operateList) {
                        console.log('title:' + document.title);
                        var heightPos = 0;
                        const dtd = new $.Deferred();
                        
                        var scrollClock = setInterval(function () {
                            if (heightPos <= $(document).height()) {
                                console.log('scroll:',heightPos);
                                heightPos += 500;
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
                            Promise.all(pList).then(values=>{ //进行局部区域监控
                                console.log('进行局部区域监控');
                                let  queryElemInfo;
                                queryElemList = [];
                                for (var j = 0; j < operateList.list.length; j++) {
                                    let elemWidth = 0,
                                        elemHeight= 0,
                                        elemvalue = 0;
                                    if((operateList.list[j].queryElem != null) && (operateList.list[j].rule != null)){
                                        let ruleSplit = operateList.list[j].rule.split('*');
                                        elemWidth = ruleSplit[0].split('x')[0];
                                        elemHeight = ruleSplit[0].split('x')[1];
                                        elemvalue = ruleSplit[1];
                                        for(var k = 0; k < $(operateList.list[j].queryElem).length;k++){
                                            if($($(operateList.list[j].queryElem)[k]).attr('src')){
                                                queryElemList.push({
                                                    'src' : $($(operateList.list[j].queryElem)[k]).attr('src'),
                                                    'elemWidth' : elemWidth,
                                                    'elemHeight': elemHeight,
                                                    'elemvalue':  elemvalue,
                                                    'name': operateList.list[j].name
                                                });
                                            }
                                        };
                                    }
                                }
                            }).then(values => {
                                console.log('!!!!!!');
                                console.log('queryElemList:'+JSON.stringify(queryElemList));
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
                        filterData(data, queryElemList, rp, item, pageTitle, pageStartTime, outObj, page, doPhantom, instance);
                    });

                }(item));
            });
        });
    }
}

doPhantom();







