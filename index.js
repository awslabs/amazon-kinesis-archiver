var debug = process.env['DEBUG'] || false;
var region = process.env['AWS_REGION'];

var archiver = require('./lib/kinesis-archiver');
var common = require('./lib/common');
var ok = 'OK';
var error = 'ERROR';

exports.handler = function(event, context) {
    /** Runtime Functions */
    var finish = function(event, status, message) {
	console.log("Processing Complete");

	// log the event if we've failed
	if (status !== ok) {
	    if (message) {
		console.log(message);
	    }

	    // ensure that Lambda doesn't checkpoint to kinesis
	    context.done(status, JSON.stringify(message));
	} else {
	    context.done(null, message);
	}
    };

    /** End Runtime Functions */
    if (debug) {
	console.log(JSON.stringify(event));
    }

    var noProcessReason;

    if (!event.Records) {
	noProcessReason = "Event contains no Data";
    }
    if (!event.eventSource === "aws:kinesis") {
	noProcessReason = "Invalid Event Source " + event.eventSource
    }

    if (noProcessReason) {
	finish(event, error, noProcessReason);
    } else {
	// process all record persistence in parallel
	async.map(event.Records, archiver.processKinesisRecord, function(err, results) {
	    if (debug) {
		console.log("Kinesis Record Processing Completed");
	    }

	    if (err) {
		finish(event, error, err);
	    } else {
		var errors = [];
		var status = ok;

		// extract all errors from parallel results
		results.map(function(item) {
		    if (item.status !== ok) {
			status = status === ok ? item.status : status;
			errors[errors.length] = item.msg;
		    }
		});

		finish(event, status, errors.length === 0 ? "Success" : JSON.stringify(errors));
	    }
	});
    }
};