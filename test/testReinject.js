var q = require('../lib/archive-access')(process.env['AWS_REGION'] || 'us-east-1');
var async = require('async');

var sqn1 = '49550822123942288925422195661801699673398497972964035234';
var sqn2 = '49550822123942288925422195661802908599218112602138741410';
var sqn3 = '49550822123942288925422195661802908599218112602138741412';
var approxArrival = 1428537600;

var everything = function(callback) {
    q.reinject('EnergyPipelineSensors', undefined, undefined, undefined, undefined, undefined, true, "^", function(err,
	    item) {
	console.log("Reinject record callback");
	if (err) {
	    console.log(err);
	} else {
	    console.log(JSON.stringify(item));
	}
    }, function(err) {
	console.log("All Data Complete");
	if (err) {
	    console.log(err);
	}
	callback(err);
    });
};

async.waterfall([ everything, ], function(err) {
    console.log("tests complete");
    process.exit(0);
});
