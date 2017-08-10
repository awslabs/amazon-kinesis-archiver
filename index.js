var debug = true;
require("./lib/constants");

exports.handler = function(event, context) {
    var finish = function(err, data) {
	console.log("Processing Complete");

	// log the event if we've failed
	if (data && data.status && data.status !== OK) {
	    if (data.message) {
		console.log(data.message);
	    }

	    // ensure that Lambda doesn't checkpoint to Kinesis
	    context.done(status, JSON.stringify(data.message ? data.message : "Unknown Error"));
	} else {
	    context.done(err);
	}
    };

    /** End Runtime Functions */
    if (debug) {
	console.log(JSON.stringify(event));
    }

    var noProcessReason;

    if (!event.Records || event.Records.length === 0) {
	noProcessReason = "Event contains no Data";
    }
    if (event.Records[0].eventSource !== "aws:kinesis") {
	noProcessReason = "Invalid Event Source " + event.eventSource;
    }
    if (event.Records[0].kinesis.kinesisSchemaVersion !== "1.0") {
	noProcessReason = "Unsupported Event Schema Version " + event.Records[0].kinesis.kinesisSchemaVersion;
    }

    var current_region = process.env[REGION_KEY];

    // setup the stream archiver if it hasn't yet been initialised
    var compressor = require('./lib/kinesis-archiver')(current_region);

    if (noProcessReason) {
	// fail processing with the specified reason
	finish(event, ERROR, noProcessReason);
    } else {
	// resolve the stream name
	var eventSourceARNTokens = event.Records[0].eventSourceARN.split(":");
	var streamName = eventSourceARNTokens[eventSourceARNTokens.length - 1].split("/")[1];

	// setup the compressor
	compressor.init(streamName, undefined, function(err) {
	    if (err) {
		finish(err);
	    } else {
		// process the stream records
		archiver.processRecords(streamName, event, finish);
	    }
	});
    }
};