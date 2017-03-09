var schedule = require('node-schedule');
var rule = new schedule.RecurrenceRule();
rule.second = [1,2,3];
// console.log(rule);
var j = schedule.scheduleJob(rule, function(){
  console.log('The answer to life, the universe, and everything!');
});


// schedule.scheduleJob('0 17 ? * 0,4-6', function(){
//   console.log('Today is recognized by Rebecca Black!');
// });


// var date = new Date(2017, 3, 8, 5, 30, 0);

// var j = schedule.scheduleJob(date, function(){
//   console.log('The world is going to end today.');
// });