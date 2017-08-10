var q = require('../lib/archive-access')(process.env['AWS_REGION'] || 'us-east-1');
var async = require('async');

var sqn1 = '49550822123942288925422195661801699673398497972964035234';
var sqn2 = '49550822123942288925422195661802908599218112602138741412';

var by_seq = function(callback) {
    q.scanArchive('EnergyPipelineSensors', sqn1, undefined, undefined, function(err, item) {
	console.log("Scan by Seq Received");
	if (err) {
	    console.log(err);
	} else {
	    console.log(JSON.stringify(item));
	}
    }, function(err) {
	console.log("Scan by Seq Complete");
	console.log(err);
	callback(err);
    });
};

async.waterfall([ by_seq ], function(err) {
    console.log("tests complete");
    process.exit(0);
});
