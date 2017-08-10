var debug = process.env['DEBUG'] || false;
var region = process.env['AWS_REGION'];

var pjson = require('../package.json');
var async = require('async');
require("./constants");
var common = require("./common");
var streamModeCache = {};

var aws;
var kinesisClient;
var dynamoDB;

module.exports = function(setRegion, kinesisClient, dynamoDB, overrideCache) {
    this.aws = require('aws-sdk');
    if (setRegion) {
	this.aws.config.update({
	    region : region
	});
    } else {
	if (!setRegion || setRegion === null || setRegion === "") {
	    this.aws.config.update({
		region : 'us-east-1'
	    });

	}
    }

    if (kinesisClient) {
	this.kinesisClient = kinesisClient;
    } else {
	// configure a new connection to kinesis streams, if one has not
	// been provided
	if (!this.kinesisClient) {
	    if (debug) {
		console.log("Connecting to Amazon Kinesis Streams in " + this.aws.config.region);
	    }
	    this.kinesisClient = new this.aws.Kinesis({
		apiVersion : '2013-12-02',
		region : this.aws.config.region
	    });
	}
    }
    if (dynamoDB) {
	this.dynamoDB = dynamoDB;
    } else {
	if (!this.dynamoDB) {
	    if (debug) {
		console.log("Connecting to Amazon DynamoDB in " + this.aws.config.region);
	    }
	    this.dynamoDB = new this.aws.DynamoDB({
		apiVersion : '2012-08-10',
		region : this.aws.config.region
	    });
	}
    }
    if (overrideCache) {
	console.log("Applying Cache Override");

	this.streamModeCache = overrideCache;
    }

    console.log("AWS Kinesis Stream Compressor online in " + this.aws.config.region);

    getFormattedDate = function(date) {
	if (!date) {
	    date = new Date();
	}

	var hour = date.getHours();
	hour = (hour < 10 ? "0" : "") + hour;

	var min = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;

	var sec = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;

	var year = date.getFullYear();

	var month = date.getMonth() + 1;
	month = (month < 10 ? "0" : "") + month;

	var day = date.getDate();
	day = (day < 10 ? "0" : "") + day;

	return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
    };

    now = function() {
	return new Date().getTime() / 1000;
    };

    randomInt = function(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
    };

    getTtlValue = function(seconds) {
	return Math.round(now() + seconds);
    };

    init = function(streamName, forceInvalidate, callback) {
	if ((!forceInvalidate || forceInvalidate === false) && streamName in streamModeCache) {
	    // cache already includes the stream recovery information, so lets
	    // go!
	    if (callback) {
		callback();
	    }
	} else {
	    console.log("Resolving Archive Mode for Stream " + streamName);

	    // revalidate the cached values every N seconds
	    setTimeout(init, reValidateArchiveModeCacheSeconds * 1000, streamName, true, undefined);

	    this.kinesisClient.listTagsForStream({
		StreamName : streamName
	    }, function(err, data) {
		if (err) {
		    callback(err);
		} else {
		    // cache entry
		    var cacheEntry = {};
		    // process the tags on the stream for the configuration info
		    data.Tags.map(function(item) {
			if (item.Key === RECOVERY_MODE_TAG_NAME) {
			    cacheEntry[RECOVERY_MODE_TAG_NAME] = item.Value;
			    console.log("Setting Archive Mode " + item.Value);
			}
			if (item.Key === ARCHIVE_TAG_NAME) {
			    var tag_values = item.Value.split(":");
			    tag_values.map(function(t) {
				var tokens = t.split("=");
				if (tokens[0] === ARCHIVE_TAG_ATTRIBUTE_NAME) {
				    cacheEntry[ARCHIVE_TAG_ATTRIBUTE_NAME] = tokens[1];
				} else if (tokens[0] === ARCHIVE_TAG_TTL_SECONDS_NAME) {
				    cacheEntry[ARCHIVE_TAG_TTL_SECONDS_NAME] = tokens[1];
				}
			    });
			}
		    });

		    // set the default archive mode if needed
		    if (!cacheEntry[RECOVERY_MODE_TAG_NAME]) {
			console.log("Setting default Archive Mode 'latest'");
			cacheEntry[RECOVERY_MODE_TAG_NAME] = RECOVERY_MODE_LATEST;
		    }

		    cacheEntry.tableName = common.getTargetTablename(streamName, cacheEntry[RECOVERY_MODE_TAG_NAME]);
		    streamModeCache[streamName] = cacheEntry;

		    // all set - lets go!
		    if (callback) {
			callback();
		    }
		}
	    });
	}
    };

    processRecords = function(streamName, event, callback) {
	var processor = processKinesisRecord.bind(undefined, streamName);

	async.map(event.Records, processor, function(err, results) {
	    if (debug) {
		console.log("Kinesis Record Processing Completed");
	    }

	    if (err) {
		console.log(err);
		callback(err);
	    } else {
		var errors = [];
		var status = OK;

		// extract all errors from parallel results
		results.map(function(item) {
		    if (item.status) {
			if (item.status !== OK) {
			    status = status === OK ? item.status : status;
			    errors.push = item.msg;
			}
		    } else {
			status = ERROR;
			if (item.msg) {
			    errors.push(item.msg);
			}
		    }
		});

		var message;
		if (errors.length > 0) {
		    message = JSON.stringify(errors);
		}
		callback(null, {
		    "event" : event,
		    "status" : status,
		    "message" : message
		});
	    }
	});
    };

    processKinesisRecord = function(streamName, record, completionCallback) {
	// lookup the stream vital details from the cache
	if (debug) {
	    console.log("Cache Configuration");
	    console.log(streamModeCache[streamName]);
	}
	var cacheEntry = streamModeCache[streamName];
	var archiveMode = cacheEntry[RECOVERY_MODE_TAG_NAME];
	var tableName = cacheEntry.tableName;
	var ttlAttributeName = cacheEntry[ARCHIVE_TAG_ATTRIBUTE_NAME];
	var ttlSeconds = cacheEntry[ARCHIVE_TAG_TTL_SECONDS_NAME];

	var partitionKey = record.kinesis.partitionKey;
	var seq = record.kinesis.sequenceNumber;
	var data = record.kinesis.data;
	var shardId = record.eventID.split(":")[0];

	if (debug) {
	    console.log("Resoved event detail:");
	    console.log({
		"partitionKey" : partitionKey,
		"seq" : seq,
		"tableName" : tableName,
		"shardID" : shardId,
		"data" : data
	    });
	}

	// check that we can store the record into ddb
	if (data.length > 400 * 1024 - partitionKey.length - seq.length - 10 /* timestamp */) {
	    completionCallback("Message Length of " + data.length + " Exceeds Max DDB Item Size");
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
		// object body
		var shardMagic = shardId + "-" + randomInt(0, 99);
		var item = {
		    Key : {},
		    TableName : tableName,
		    UpdateExpression : "set lastUpdate = :updateTime, recordData = :data, shardId = :shardId, shardMagic = :shardMagic, approximateArrivalTimestamp = :approxArrival",
		    ExpressionAttributeValues : {
			":updateTime" : {
			    S : getFormattedDate(),
			},
			":data" : {
			    S : data
			},
			":shardId" : {
			    S : shardId
			},
			":shardMagic" : {
			    S : "" + shardMagic
			},
			":approxArrival" : {
			    N : "" + record.kinesis.approximateArrivalTimestamp
			}
		    }
		};

		// set the primary key
		item.Key[partitionKeyName] = {
		    S : partitionKey
		};

		if (archiveMode === RECOVERY_MODE_LATEST) {
		    /*
		     * sequence number must be lower or not found
		     */
		    item.ConditionExpression = "#seq < :sequence or attribute_not_exists(#seq)";

		    // add the sequence as update expressions to set the new
		    // value
		    item.UpdateExpression = item.UpdateExpression + ",#seq = :sequence";
		    item.ExpressionAttributeNames = {
			"#seq" : sortKeyName
		    };
		    item.ExpressionAttributeValues[":sequence"] = {
			S : '' + seq
		    };
		} else {
		    // RECOVERY_MODE_ALL uses the sequence as the sort key
		    item.Key[sortKeyName] = {
			S : seq
		    };
		}

		// add ttl information
		if (ttlAttributeName) {
		    item.UpdateExpression = item.UpdateExpression + ", #ttlAttribute = :expireAfter";
		    if (item.ExpressionAttributeNames) {
			item.ExpressionAttributeNames["#ttlAttribute"] = ttlAttributeName;
		    } else {
			item.ExpressionAttributeNames = {
			    "#ttlAttribute" : ttlAttributeName
			};
		    }
		    item.ExpressionAttributeValues[":expireAfter"] = {
			N : "" + getTtlValue(ttlSeconds)
		    };
		}

		if (debug) {
		    console.log(JSON.stringify(item));
		}

		// update ddb
		this.dynamoDB.updateItem(item, function(err, data) {
		    if (err) {
			if (err.code === conditionCheckFailed) {
			    /*
			     * no problem - something wrote a later record so
			     * we're done
			     */
			    if (debug) {
				console.log("Duplicate record with archive mode " + archiveMode + ". Continuing...");
			    }
			    proceed = true;
			    whilstCallback();
			} else if (err.code === provisionedThroughputExceeded) {
			    console.log("Provisioned Throughput Exceeded - add Write IOPS!");

			    // exponential backoff with 10ms jitter
			    setTimeout((50 * (2 ^ tryNumber)) + randomInt(0, 10), whilstCallback());
			} else {
			    asyncError = err;
			    proceed = true;
			    whilstCallback(err);
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
		    completionCallback(err, null);
		} else {
		    if (asyncError) {
			// throw errors which were encountered during async
			// calls
			completionCallback(asyncError, null);
		    } else {
			if (!proceed) {
			    // we timed out while trying to write the item to
			    // ddb
			    completionCallback(null, {
				status : ERROR,
				partitionKey : partitionKey,
				sequence : seq,
				msg : "Timeout while trying to update DDB"
			    });
			} else {
			    // done ok
			    completionCallback(null, {
				status : OK,
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
	    }
	    completionCallback(err, {
		status : ERROR,
		partitionKey : partitionKey,
		sequence : seq,
		msg : null
	    });
	}
    };

    return this;
};