import createHar from './createHar'
import winston from 'winston'
import {saveData} from './storage'
let har = {};

winston.configure({
    transports: [
        new(winston.transports.File)({
            filename: 'logInfo.log'
        })
    ]
});
//es6
module.exports = function (data, queryElemList, rp, item, pageTitle, pageStartTime, outObj, page, doPhantom, instance) {
    const reg = /^image/g;
    let isImageValue,
        imageSizeValue,
        imageUrl,
        testImg = [],
        testImgSep = [],
        isImage,
        specAreaListNum = 0,
        commonListNum = 0,
        //0=>specAreaList   1=> commonList
        badImageType,
        queryReportData = [],
        badImage = {
            'specAreaList': [],
            'commonList': []
        };
    console.log('!!!operateEnd');

    for (var z = 0; z < queryElemList.length; z++) {
        if (!/s.\d*x.\d*._jfs/.test(queryElemList[z].src)) {
            testImgSep[specAreaListNum] = (function (badImage, specAreaListNum, queryElemList, z) {
                return rp('http:' + queryElemList[z].src.split('!')[0] + '!imginfo').then(function (imgRes) {
                    function saveBadImg(src, width, height, fileSize, area, msg) {
                        //es6 
                        badImage.specAreaList[specAreaListNum] = {};
                        badImage.specAreaList[specAreaListNum].src = 'http:' + src;
                        badImage.specAreaList[specAreaListNum].width = width;
                        badImage.specAreaList[specAreaListNum].height = height;
                        badImage.specAreaList[specAreaListNum].fileSize = fileSize;
                        badImage.specAreaList[specAreaListNum].area = area;
                        badImage.specAreaList[specAreaListNum].msg = msg;
                        console.log('area', area, 'specAreaListNum', specAreaListNum, 'msg', msg, 'src', badImage.specAreaList[specAreaListNum].src);
                    }
                    imgRes = JSON.parse(imgRes);
                    if (imgRes.width === queryElemList[z].elemWidth) {
                        saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name, '(异常宽' + imgRes.width + '/规定宽' + queryElemList[z].elemWidth + ') ');
                    } else if (imgRes.height === queryElemList[z].elemHeight) {
                        saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name, '(异常高' + imgRes.height + '/规定高' + queryElemList[z].elemHeight + ') ');
                    } else if (imgRes.fileSize >= queryElemList[z].elemvalue * 1024) {
                        console.log('imgRes.fileSize', imgRes.fileSize, 'queryElemList[z].elemvalue', queryElemList[z].elemvalue);
                        saveBadImg(queryElemList[z].src, imgRes.width, imgRes.height, imgRes.fileSize, queryElemList[z].name, '(异常大小' + Math.floor(imgRes.fileSize / 1024) + 'kb' + '/规定大小' + queryElemList[z].elemvalue + 'kb) ');
                    } else {
                        console.log('图片符合规则');
                    }
                }).catch(function (err) {
                    console.log(err);
                    console.log('退出1');
                    instance.exit();
                    // doPhantom();
                });
            })(badImage, specAreaListNum, queryElemList, z);
        }
        specAreaListNum++;
    }
    har = createHar(item.url, pageTitle, pageStartTime, outObj.pageResource, page);
    for (let i = 0; i < har.log.entries.length; i++) {
        isImageValue = har.log.entries[i].response.headers[2].value;
        imageSizeValue = har.log.entries[i].response.headers[3].value;
        imageUrl = har.log.entries[i].request.url;
        isImage = reg.test(isImageValue);
        reg.test(isImageValue); //这里必须执行一下，才能遍历所有的值？
        if (isImage) {
            //检测图片是否符合尺寸规则
            var b2kb = imageSizeValue / 1024;
            if (b2kb >= item.minSizeValue) {
                console.info('size::::::', b2kb, '!!!!!!!!!!!!!!!!!!!!!!', imageUrl);
                testImg[commonListNum] = (function (badImage, imageUrl, b2kb, commonListNum) {
                    return rp(imageUrl.split('!')[0] + '!imginfo').then(function (imgRes) {
                        imgRes = JSON.parse(imgRes);
                        if (((imgRes.width >= 600 || imgRes.height >= 600) && b2kb >= 150) || ((imgRes.width >= 200 || imgRes.height >= 200) && b2kb >= 40) || ((imgRes.width >= 400 || imgRes.height >= 400) && b2kb >= 100)) {
                            badImage.commonList[commonListNum] = {};
                            badImage.commonList[commonListNum].src = imageUrl;
                            badImage.commonList[commonListNum].width = imgRes.width;
                            badImage.commonList[commonListNum].height = imgRes.height;
                            badImage.commonList[commonListNum].fileSize = imgRes.fileSize;
                            badImage.commonList[commonListNum].msg = 'HAR信息监控素材';
                        }
                    }).catch(function (err) {
                        console.log(err);
                        console.log('退出2');
                        instance.exit();
                        // doPhantom();
                    });
                })(badImage, imageUrl, b2kb, commonListNum);
                commonListNum++;
            } //end of if
        }
    } //end of for
    let testImgAll = testImg.concat(testImgSep);
    Promise.all(testImgAll).then((values) => {
        let msg = '【素材监控平台】' + item.name + ':',
            specAreaListTemp = badImage.specAreaList,
            specAreaListLength = badImage.specAreaList.length;
        if (badImage.commonList.length > 0) {
            msg = msg + 'HAR信息监控素材:共' + badImage.commonList.length + '张异常图片。';
        }
        console.log('badImage.specAreaList.length', badImage.specAreaList.length, 'specAreaListLength', specAreaListLength);
        console.log(badImage.specAreaList);
        badImage.specAreaList = [];
        for (let i = 0; i < specAreaListLength; i++) {
            if (specAreaListTemp[i] != undefined) {
                console.log(specAreaListTemp[i]);
                badImage.specAreaList.push(specAreaListTemp[i]);
            }
        }
        if (badImage.specAreaList.length === 0) {
            msg = msg + '特定区域无异常信息。 ';
        } else {
            for (let k = 0; k < badImage.specAreaList.length; k++) {
                console.log(badImage.specAreaList[k]);
                msg = msg + badImage.specAreaList[k].area + '区域，异常信息' + (parseInt(k) + 1) + '：' + badImage.specAreaList[k].msg + ' ';
            }
        }
        msg = msg + '请登录素材监控平台查看异常详情';
        let reportData = {
            'type': 1,
            'data': [{
                'id': '58bd039960965549fbdd332c',
                'msg': msg,
                'detail': badImage
            }]
        };
        console.log('reportData',JSON.stringify(reportData));
        let options = {
            method: 'POST',
            uri: 'http://aotu.jd.com/monitor/api/common/report',
            body: reportData,
            json: true
        };
        if (badImage.specAreaList.length || badImage.commonList.length) {
            console.log('上报：', msg);
            winston.info(reportData);
            // saveData(reportData, doPhantom, instance.exit);
            rp(options)
                .then(data => {
                    if (data.rtn === 0) {
                        console.log('正常上报退出3');
                        instance.exit();
                        doPhantom();
                    }
                })
                .catch(function (err) {
                    console.log('上报异常退出4');
                    instance.exit();
                    // doPhantom();
                });
        } else {
            console.log('不上报：', msg);
            console.log('正常不上报退出5');
            instance.exit();
            doPhantom();
        }
    }).catch(function(err){
        console.log(err);
        instance.exit();
    });
    process.on('unhandledRejection',function(err,promise){
        console.log(err)
        console.log(promise)
    })
}