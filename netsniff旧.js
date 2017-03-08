if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

function createHAR(address, title, startTime, resources)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
	}

        entries.push({
            startedDateTime: request.time.toISOString(),
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
                name: "PhantomJS",
                version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
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
var request = require('request');
var page = require('webpage').create(),
    fs = require('fs'),
    system = require('system'),
    events = require('events');
    var Q = require('q');
 var emitter = new events.EventEmitter();
 page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';  


if (system.args.length === 1) {
    console.log('Usage: netsniff.js <some URL>');
    phantom.exit(1);
} else {

    page.address = system.args[1];
    page.resources = [];

    page.onLoadStarted = function () {
        page.startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        page.resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            page.resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            page.resources[res.id].endReply = res;
        }
    };
    page.viewportSize = {
        width: 1980,
        height: 2000
    };
    page.onConsoleMessage = function(msg) {
        if(msg === 'scollEnd'){
            emitter.emit('scollEnd',"滚动完毕");  
        }
        console.log(msg);
    }
    page.open(page.address, function (status) {
        var har;
        if (status !== 'success') {
            console.log('FAIL to load the address');
            phantom.exit(1);
        } else {
            page.title = page.evaluate(function () {
                var heightPos = 0;
                var scrollClock = setInterval(function(){
                    if(heightPos <= $(document).height()){
                        heightPos += 500;
                        console.log(heightPos);
                        window.document.body.scrollTop = heightPos;
                    }else{
                       console.log('scollEnd');  
                       clearInterval(scrollClock);
                       return $(document).title;
                    }
                },400);
            });
            emitter.on('scollEnd',function(){
                console.log('scollEndscollEndscollEndscollEndscollEnd');
                setTimeout(function(){
                    console.log(page.title);
                    page.render(page.title+ '.jpg', { format: "jpg", quality: 500 });
                    console.log('截图ing');
                    har = createHAR(page.address, page.title, page.startTime, page.resources);
                    // console.log(JSON.stringify(har, undefined, 4));
                    // var reg = /^image/g;
                    // var isImageValue,
                    //     imageSizeValue,
                    //     imageUrl,
                    //     isImage;
                    //     console.log(har.log.entries.length);
                    // for(var i = 0; i < har.log.entries.length; i++){
                    //     isImageValue = har.log.entries[i].response.headers[2].value;
                    //     imageSizeValue = har.log.entries[i].response.headers[3].value;
                    //     imageUrl = har.log.entries[i].request.url;
                    //     isImage = reg.test(isImageValue)
                    //     if(isImage){
                    //         console.log(imageSizeValue);
                    //         console.log(imageUrl);
                    //         testImg(imageUrl, imageSizeValue);
                    //     }
                    // }
                    console.log(JSON.stringify(har, undefined, 4));
                    fs.writeFile(page.title + '.har', JSON.stringify(har, undefined, 4), 'w');
                    console.log('===============');
                    console.log(JSON.stringify(badImage));
                    console.log('===============');
                    // throw new Error('xxxx');
                    phantom.exit(1);
                    // return badImage;
                },3000);
            });
        }
    });
}
var badImage = [];
//检测图片是否符合尺寸规则
function testImg(url,size){
    if(size/100 > 100){
        console.log('size::::::'+size);
        badImage.push(url);
    }
}

