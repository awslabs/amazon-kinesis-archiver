var q = require('../lib/archive-access')(process.env['AWS_REGION'] || 'us-east-1');
var async = require('async');

var sqn1 = '49550822123942288925422195661801699673398497972964035234';
var sqn2 = '49550822123942288925422195661802908599218112602138741410';
var sqn3 = '49550822123942288925422195661802908599218112602138741412';
var approxArrival = 1428537600;

var everything = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.scanArchive('EnergyPipelineSensors', undefined, undefined, undefined, undefined, queue, function(err) {
	console.log("All Data Test Completed - waiting for queue workers");

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

var by_seq = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.scanArchive('EnergyPipelineSensors', sqn2, undefined, undefined, undefined, queue, function(err) {
	console.log("Scan by Seq Complete");
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

var by_approx = function(callback) {
    var drained = false;
    var worker = function(task, wCallback) {
	console.log(task);
	wCallback();
    };
    var queue = async.queue(worker, 2);
    queue.drain = function() {
	drained = true;
    }

    q.scanArchive('EnergyPipelineSensors', sqn2, undefined, approxArrival, undefined, queue, function(err) {
	console.log("Scan by Approx Complete");
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

var console_support = function(callback) {
    q.scanToStdConsole('EnergyPipelineSensors', sqn1, undefined, undefined, 10, callback);
};

async.waterfall([ everything, by_seq, by_approx, console_support ], function(err) {
    console.log("tests complete");
    process.exit(0);
});
