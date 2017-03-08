"use strict";
var page = require('webpage').create();
var fs = require('fs');
var path = 'images/';
var readHar = require(phantom.libraryPath + '/netsniff.js');

page.onConsoleMessage = function(msg) {
    console.log(msg);
};
page.open("http://jd.com/", function(status) {
    if (status === "success") {
        page.includeJs("http://libs.baidu.com/jquery/1.9.1/jquery.min.js", function() {
            page.evaluate(function() {
                var spiderImg = function(){
                    if($('.J_slider_item img') && $('.J_slider_item img').length){
                        for(var i = 0; i < $('.J_slider_item img').length; i++){
                            var srcPath = ($('.J_slider_item img')[i].src);
                            page.open(srcPath, function (status) {
                                var har;
                                if (status !== 'success') {
                                    console.log('FAIL to load the address');
                                    phantom.exit(1);
                                } else {
                                    page.endTime = new Date();
                                    page.title = page.evaluate(function () {
                                        return document.title;
                                    });
                                    har = readHar(page.address, page.title, page.startTime, page.resources);
                                    console.log(JSON.stringify(har, undefined, 4));
                                    phantom.exit();
                                }
                            });
                        }
                    }else{
                        console.log('等待加载ing');
                        setTimeout(function() {
                            spiderImg();
                        }, 1000);
                    }
                }
                spiderImg();
            });
            page.render('1.png');
            phantom.exit(0);
        });
    } else {
      phantom.exit(1);
    }
});