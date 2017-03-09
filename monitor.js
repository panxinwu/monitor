const phantom = require('phantom'),
      events = require('events'),
      system = require('system'),
      fs = require('fs'),
      emitter = new events.EventEmitter(),
      url = process.argv[2],
      dataList = [];

let   pageTitle = '',
      pageResource = [];
      

(async function() {
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
    
    await page.property('viewportSize', {width: 1024, height: 600});
    await page.on("onConsoleMessage", function(msg) {
        if(msg === 'scrollEnd'){
             emitter.emit('scrollEnd',"滚动完毕");
             
        }
        if(/^title/g.test(msg)){
            pageTitle = msg.split(':')[1];
        }
        console.info(msg)
    });
    page.on('onLoadStarted', function() {
        pageStartTime = new Date();
    });
    // page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';  
    const status = await page.open(url);
    const content = await page.property('content');
    

    let outObj = instance.createOutObject();
    outObj.pageResource = [];
    outObj.pageRecieved = [];


    await page.on('onCallback', async function (data) {
        switch(data) {
            case 1:
                await instance.exit();
                break;
        }
    });
   
    await page.evaluateAsync(function () {
        console.log('title:'+document.title);
        var heightPos = 0;
        var dtd = new $.Deferred();
        var scrollClock = setInterval(function(){
            if(heightPos <= $(document).height()){
                heightPos += 500;
                console.log(heightPos);
                window.document.body.scrollTop = heightPos;
            }else{
                dtd.resolve();
            }
        },400);
        $.when(dtd).then(function () {
            window.callPhantom(2);
            console.log('scrollEnd'); 
            clearInterval(scrollClock);
            window.callPhantom(1);
        });
    }, 0);
    
    page.on('onResourceRequested', function (req, net, out) {
        out.pageResource[req.id] = {
                request: req,
                startReply: null,
                endReply: null
            };
    }, outObj);
    page.on('onResourceReceived', function(res, outObj) {
        outObj.pageResource[res.id] =  outObj.pageResource[res.id] || {};
        if (res.stage === 'start') {
            outObj.pageResource[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            outObj.pageResource[res.id].endReply = res;
        }
    }, outObj);

    emitter.on('scrollEnd',function(data){
        // await page.render(pageTitle+ '.jpg', { format: "jpg", quality: 500 });
        // console.log('截图ing');
        // console.log('======================================');
        // console.log(outObj.pageResource);
        har = createHAR(url,pageTitle, pageStartTime, outObj.pageResource);
        // console.log(JSON.stringify(har, undefined, 4));
        var reg = /^image/g;
        var isImageValue,
            imageSizeValue,
            imageUrl,
            isImage;
            // console.log(har.log.entries.length);
        for(var i = 0; i < har.log.entries.length; i++){
            isImageValue = har.log.entries[i].response.headers[2].value;
            imageSizeValue = har.log.entries[i].response.headers[3].value;
            imageUrl = har.log.entries[i].request.url;
            isImage = reg.test(isImageValue)
            if(isImage){
                testImg(imageUrl, imageSizeValue);
            }
        }
        // fs.writeFile(pageTitle + '.har', JSON.stringify(har, undefined, 4), 'w');
        console.log('===============');
        console.log(badImage);
        // report(JSON.stringify(badImage));
    });


    var badImage = [];
    //检测图片是否符合尺寸规则
    function testImg(url,size){
        if(size/100 > 100){
            // console.log('size::::::'+size);
            badImage.push(url);
        }
    }
}());
