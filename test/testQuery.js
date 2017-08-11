var q = require('../lib/archive-access')(process.env['AWS_REGION'] || 'us-east-1');
var async = require('async');

var sqn1 = '49550822123942288925422195661802908599218112602138741410';
var sqn2 = '49550822123942288925422195661802908599218112602138741412';

var by_item = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.queryArchive('EnergyPipelineSensors', '3388323060863249599', sqn1, sqn1, undefined, queue, function(err) {
	console.log("Query by Item Complete");
	async.until(function() {
	    return drained;
	}, function(untilCallback) {
	    setTimeout(function() {
		untilCallback();
	    }, 500);
	}, function(err) {
	    callback(err);
	});
    });
};

var by_range = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.queryArchive('EnergyPipelineSensors', '3388323060863249599', sqn1, sqn2, 10, queue, function(err) {
	console.log("Query by Range Complete");
	async.until(function() {
	    return drained;
	}, function(untilCallback) {
	    setTimeout(function() {
		untilCallback();
	    }, 500);
	}, function(err) {
	    callback(err);
	});
    });
};

var all_for_key = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.queryArchive('EnergyPipelineSensors', '3388323060863249599', undefined, undefined, undefined, queue,
	    function(err) {
		console.log("Data for All Complete");
		async.until(function() {
		    return drained;
		}, function(untilCallback) {
		    setTimeout(function() {
			untilCallback();
		    }, 500);
		}, function(err) {
		    callback(err);
		});
	    });
};

async.waterfall([ by_item, by_range, all_for_key ], function(err) {
    console.log("tests complete");
    process.exit(0);
});
