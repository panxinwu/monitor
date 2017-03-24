const   phantom = require('phantom'),
        events = require('events'),
        system = require('system'),
        fs = require('fs'),
        dataList = [],
        winston = require('winston');

let     pageTitle = '',
        pageResource = [],
        pageStartTime = '',
        har = {};

let queryElemList = [];
import rp from 'request-promise';
require('shelljs/global');

winston.configure({
    transports: [
        new (winston.transports.File)({ filename: 'logInfo.log' })
    ]
});

async function doPhantom() {
    let res = await rp('http://aotu.jd.com/monitor/api/common/materials');
    //http://aotu.jd.com/monitor/api/common/materials
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
                    const createHar = require('./lib/createHar');
                    const instance = await phantom.create();
                    const page = await instance.createPage();
                    // page.injectJs('./lib/createHar.js');
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
                                await instance.exit();
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
                        const reg = /^image/g;
                        let isImageValue,
                            imageSizeValue,
                            imageUrl,
                            testImg = [],
                            testImgSep = [],
                            isImage,
                            specAreaListNum = 0,
                            commonListNum = 0,
                            badImageType,//0=>specAreaList   1=> commonList
                            badImage = {
                                'specAreaList': [],
                                'commonList':[]
                            };
                        console.log('operateEnd');
                        let queryReportData = [];
                        
                        for(var z = 0; z < queryElemList.length; z++){
                            if(/s.\d*x.\d*._jfs/.test(queryElemList[z].src)){
                                console.log('asdfasfdaw',queryElemList[z].src);
                            }else{
                                 testImgSep[specAreaListNum] =  (function(badImage,specAreaListNum,queryElemList,z){
                                    return rp('http:'+queryElemList[z].src.split('!')[0] + '!imginfo').then(function(imgRes){
                                        function saveBadImg(src, width, height, fileSize, area, msg){
                                            badImage.specAreaList[specAreaListNum] = {};
                                            badImage.specAreaList[specAreaListNum].src = 'http:'+src;
                                            badImage.specAreaList[specAreaListNum].width = width;
                                            badImage.specAreaList[specAreaListNum].height = height;
                                            badImage.specAreaList[specAreaListNum].fileSize = fileSize;
                                            badImage.specAreaList[specAreaListNum].area = area;
                                            badImage.specAreaList[specAreaListNum].msg = msg;
                                            console.log('area',area,'specAreaListNum',specAreaListNum,'msg',msg,'src',badImage.specAreaList[specAreaListNum].src);
                                        }
                                        imgRes = JSON.parse(imgRes);
                                        if(imgRes.width === queryElemList[z].elemWidth){
                                           saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name,'(异常宽'+imgRes.width+'/规定宽'+queryElemList[z].elemWidth+') ');
                                        }else if(imgRes.height === queryElemList[z].elemHeight){
                                           saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name,'(异常高'+imgRes.height+'/规定高'+queryElemList[z].elemHeight+') ');
                                        }else if(imgRes.fileSize >= queryElemList[z].elemvalue*1024){
                                            console.log('imgRes.fileSize',imgRes.fileSize,'queryElemList[z].elemvalue',queryElemList[z].elemvalue);
                                            saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name, '(异常大小'+Math.floor(imgRes.fileSize/1024)+'kb'+'/规定大小'+queryElemList[z].elemvalue+'kb) ');
                                        }else{
                                            console.log('图片符合规则');
                                        }
                                    });
                                })(badImage,specAreaListNum,queryElemList,z);
                            }
                              specAreaListNum++;
                        }
                        har =  createHar(item.url, pageTitle, pageStartTime, outObj.pageResource,page);
                        for (let i = 0; i < har.log.entries.length; i++) {
                            isImageValue = har.log.entries[i].response.headers[2].value;
                            imageSizeValue = har.log.entries[i].response.headers[3].value;
                            imageUrl = har.log.entries[i].request.url;
                            isImage = reg.test(isImageValue);
                            reg.test(isImageValue); //这里必须执行一下，才能遍历所有的值？
                            if (isImage) {
                                 //检测图片是否符合尺寸规则
                                var b2kb = imageSizeValue/1024;
                                if(b2kb >= 40){
                                    console.info('size::::::',b2kb,'!!!!!!!!!!!!!!!!!!!!!!',imageUrl);
                                    testImg[commonListNum] =  (function(badImage,imageUrl,b2kb,commonListNum){
                                        return rp(imageUrl.split('!')[0] + '!imginfo').then(function(imgRes){
                                            imgRes = JSON.parse(imgRes);
                                            // console.log(imgRes.width);
                                            // console.log(imgRes.height);
                                            // console.log(b2kb);
                                            // const map = [
                                            //     {
                                            //         start: 200,
                                            //         end: 400,
                                            //         maxb2kb: 40
                                            //     },
                                            //     {
                                            //         start: 400,
                                            //         end: 600,
                                            //         maxb2kb: 100
                                            //     }
                                            // ];
                                            if(((imgRes.width >= 600 || imgRes.height >= 600) && b2kb >=150) || ((imgRes.width >= 200 || imgRes.height >= 200) && b2kb >=40) || ((imgRes.width >= 400 || imgRes.height >= 400) && b2kb >=100)){
                                                badImage.commonList[commonListNum] = {};
                                                badImage.commonList[commonListNum].src = imageUrl;
                                                badImage.commonList[commonListNum].width = imgRes.width;
                                                badImage.commonList[commonListNum].height = imgRes.height;
                                                badImage.commonList[commonListNum].fileSize = imgRes.fileSize;
                                                badImage.commonList[commonListNum].msg = 'HAR信息监控素材';
                                            }
                                        }).then((imgres) => imgres).catch(function(err){
                                            console.log(err);
                                        });
                                    })(badImage,imageUrl,b2kb,commonListNum);
                                    commonListNum++;
                                }//end of if
                            }
                        }//end of for
                        let testImgAll = testImg.concat(testImgSep);
                        Promise.all(testImgAll).then(function(values){
                            let msg = '【素材监控平台】'+ item.name + ':',
                                specAreaListTemp = badImage.specAreaList,
                                specAreaListLength = badImage.specAreaList.length;
                            if(badImage.commonList.length > 0){
                                msg = msg + 'HAR信息监控素材:共'+ badImage.commonList.length+ '张异常图片。';
                            }
                            console.log('badImage.specAreaList.length',badImage.specAreaList.length,'specAreaListLength',specAreaListLength);
                            console.log(badImage.specAreaList);
                            badImage.specAreaList = [];
                            for(let i = 0; i< specAreaListLength; i++){
                                if(specAreaListTemp[i] != undefined){
                                    console.log(specAreaListTemp[i]);
                                     badImage.specAreaList.push(specAreaListTemp[i]);
                                }
                            }
                            if(badImage.specAreaList.length === 0){
                                msg = msg + '特定区域无异常信息。 ';
                            }else{
                                for(let k = 0; k< badImage.specAreaList.length; k++){
                                    console.log(badImage.specAreaList[k]);
                                    msg = msg + badImage.specAreaList[k].area + '区域，异常信息' + (parseInt(k)+1)+  '：' + badImage.specAreaList[k].msg + ' ';
                                }
                            }
                            
                            msg = msg + '请登录素材监控平台查看异常详情';
                            let options = {
                                method: 'POST',
                                uri: 'http://aotu.jd.com/monitor/api/common/report',
                                body: {
                                        'type': 1,
                                        'data': [
                                            {
                                            'id': '58bd039960965549fbdd332c',
                                            'msg': msg,
                                            'detail': badImage 
                                            }
                                        ]
                                },
                                json: true
                            };
                            rp(options)
                                .then(data => {
                                    if(data.rtn === 0){
                                        doPhantom();
                                    }
                                })
                                .catch(function (err) {
                                    doPhantom();
                                });
                            console.log(msg);
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







