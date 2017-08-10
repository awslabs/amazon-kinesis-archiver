var q = require('../lib/archive-access')(process.env['AWS_REGION'] || 'us-east-1');
var async = require('async');

var sqn1 = '49550822123942288925422195661802908599218112602138741410';
var sqn2 = '49550822123942288925422195661802908599218112602138741412';

var by_item = function(callback) {
    q.queryArchive('EnergyPipelineSensors', '3388323060863249599', sqn1, sqn1, undefined, function(err, item) {
	console.log("Data by Item Received");
	if (err) {
	    console.log(err);
	} else {
	    console.log(JSON.stringify(item));
	}
    }, function(err) {
	console.log("Query by Item Complete");
	console.log(err);
	callback(err);
    });
};

var by_range = function(callback) {
    q.queryArchive('EnergyPipelineSensors', '3388323060863249599', sqn1, sqn2, 10, function(err, item) {
	console.log("Data by Range Received");
	if (err) {
	    console.log(err);
	} else {
	    console.log(JSON.stringify(item));
	}
    }, function(err) {
	console.log("Query by Range Complete");
	console.log(err);
	callback(err);
    });
};

async.waterfall([ by_item, by_range ], function(err) {
    console.log("tests complete");
    process.exit(0);
});
