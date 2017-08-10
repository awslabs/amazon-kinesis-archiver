var debug = process.env['DEBUG'] || false;

var pjson = require('./package.json');
var region = process.env['AWS_REGION'];
var archiver = require('./lib/kinesis-archiver');
var common = require('./lib/common');

if (!region || region === null || region === "") {
	region = "us-east-1";
	console.log("AWS Kinesis Stream Archiver in " + region);
}

var aws = require('aws-sdk');
aws.config.update({
	region : region
});
var dynamoDB = new aws.DynamoDB({
	apiVersion : '2012-08-10',
	region : region
});
var async = require('async');
var conditionCheckFailed = 'ConditionalCheckFailedException';
var provisionedThroughputExceeded = 'ProvisionedThroughputExceededException';

function processKinesisRecord(record, callback) {
    var eventSourceARNTokens = record.eventSourceARN.split(":");
    var streamName = eventSourceARNTokens[eventSourceARNTokens.length - 1].split("/")[1];
    var partitionKey = record.kinesis.partitionKey;
    var seq = record.kinesis.sequenceNumber;
    var tableName = streamName + "-compressed";
    var data = new Buffer(record.kinesis.data, 'base64').toString('ascii');

    if (debug) {
	console.log({
	    partitionKey : partitionKey,
	    seq : seq,
	    tableName : tableName,
	    data : data
	});
    }

    // check that we can store the record into ddb
    if (data.length > 400 * 1024 - partitionKey.length - seq.length - 10 /* timestamp */) {
	finish(null, error, "Message Length of " + data.length + " Exceeds Max DDB Item Size");
    }

    try {
	var proceed = false;
	var tryNumber = 0;
	var retryLimit = 20;
	var asyncError;

	// async whilst gives us a retry mechanism in case of provisioned
	// throughput errors or whatever
	async.whilst(function() {
	    // return OK if the proceed flag has
	    // been set, or if we've hit the
	    // retry count
	    return !proceed && tryNumber < retryLimit;
	}, function(whilstCallback) {
	    tryNumber++;

	    // build the params for an atomic update of the
	    // object body if the sequence number is lower
	    // than this one
	    var item = {
		Key : {
		    partitionKey : {
			S : partitionKey
		    }
		},
		TableName : tableName,
		UpdateExpression : "set #seq = :sequence, lastUpdate = :updateTime, recordData = :data",
		ExpressionAttributeNames : {
		    "#seq" : 'lastSequence'
		},
		ExpressionAttributeValues : {
		    ":sequence" : {
			S : '' + seq
		    // TODO will this deal with 128bit number
		    // ok?
		    },
		    ":updateTime" : {
			S : exports.getFormattedDate(),
		    },
		    ":data" : {
			S : data
		    }
		},
		/*
		 * sequence number must be lower or not found
		 */
		ConditionExpression : "#seq < :sequence or attribute_not_exists(#seq)"
	    };

	    // update ddb
	    dynamoDB.updateItem(item, function(err, data) {
		if (err) {
		    if (err.code === conditionCheckFailed) {
			/*
			 * no problem - something wrote a later record so we're
			 * done
			 */
			if (debug) {
			    console.log("Condition Check Failed");
			}
			proceed = true;
			whilstCallback();
		    } else if (err.code === provisionedThroughputExceeded) {
			console.log("Provisioned Throughput Exceeded - add Write IOPS!");

			// exponential backoff
			// with 10ms jitter
			setTimeout((50 * (2 ^ tryNumber)) + exports.randomInt(0, 10), whilstCallback());
		    } else {
			asyncError = err;
			proceed = true;
			whilstCallback();
		    }
		} else {
		    /*
		     * no error - the body was updated on the item
		     */
		    proceed = true;
		    whilstCallback();
		}
	    });
	}, function(err) {
	    // function called when the async retry completes
	    if (err) {
		callback(err, null);
	    } else {
		if (asyncError) {
		    // throw errors which were encountered
		    // during async
		    // calls
		    callback(asyncError, null);
		} else {
		    if (!proceed) {
			// we timed out while trying to write
			// the item to
			// ddb
			callback(null, {
			    status : error,
			    partitionKey : partitionKey,
			    sequence : seq,
			    msg : "Timeout while trying to update DDB"
			});
		    } else {
			// done ok
			callback(null, {
			    status : ok,
			    partitionKey : partitionKey,
			    sequence : seq,
			    msg : null
			});
		    }
		}
	    }
	});
    } catch (err) {
	if (debug) {
	    console.log("Catch of core record processing");
	    console.log(JSON.stringify(err));
	} else {
	    callback(err, {
		status : error,
		partitionKey : partitionKey,
		sequence : seq,
		msg : null
	    });
	}
    }
};
exports.processKinesisRecord = processKinesisRecord;