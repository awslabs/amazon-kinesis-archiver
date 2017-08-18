var debug = process.env['DEBUG'] || false;
require("./constants");
var common = require("./common");
var aws;
var kinesisClient;
var dynamoDB;
var async = require('async');

module.exports = function(setRegion, kinesisClient, dynamoDB) {
    this.aws = require('aws-sdk');
    if (setRegion) {
	this.aws.config.update({
	    region : setRegion
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
	    this.kinesisClient = new this.aws.Kinesis({
		apiVersion : '2013-12-02',
		region : this.aws.config.region
	    });
	    if (debug) {
		console.log("Connected to Amazon Kinesis Streams in " + this.kinesisClient.config.region);
	    }
	}
    }

    if (dynamoDB) {
	this.dynamoDB = dynamoDB;
    } else {
	if (!this.dynamoDB) {
	    this.dynamoDB = new this.aws.DynamoDB({
		apiVersion : '2012-08-10',
		region : this.aws.config.region
	    });
	    if (debug) {
		console.log("Connected to Amazon DynamoDB in " + this.dynamoDB.config.region);
	    }
	}
    }

    console.log("AWS Kinesis Stream Archive Query Engine online in " + this.aws.config.region);

    /**
     * function interface to scan through the archive sequentially with the
     * potential filters provided
     */
    reinject = function(sourceStreamName, targetStreamName, sequenceStart, lastUpdateDateStart,
	    approximateArrivalStart, recordLimit, includeReinjectMetadata, metadataSeparator, threads, callback) {
	var destinationStream = (targetStreamName ? targetStreamName : sourceStreamName);

	var worker = function(record, wCallback) {
	    // decode the data stored in the table
	    var data = new Buffer(record.recordData.S, 'Base64').toString(intermediateEncoding);

	    // process whether we should add the original metadata to
	    // the
	    // message before emitting
	    if (includeReinjectMetadata) {
		data = JSON.stringify({
		    "originalApproximateArrivalTimestamp" : record.approximateArrivalTimestamp.N,
		    "originalShardId" : record.shardId.S,
		    "originalSequenceNumber" : record.sequenceNumber.S
		}) + metadataSeparator + data;
	    }

	    var params = {
		StreamName : destinationStream,
		PartitionKey : record.partitionKey.S,
		Data : new Buffer(data, intermediateEncoding)
	    };

	    console.log(params.Data.toString('ascii'))

	    this.kinesisClient.putRecord(params, function(err, data) {
		wCallback(err, data);
	    });
	};
	var queue = async.queue(worker, threads);
	var scanCompleted = false;
	queue.drain = function() {
	    async.until(function() {
		return scanCompleted;
	    }, function(untilCallback) {
		setTimeout(function() {
		    untilCallback();
		}, 500);
	    }, function(err) {
		callback(err);
	    });
	};

	// scan through the stored archive using the supplied filters
	scanArchive(sourceStreamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit, queue,
		function(err) {
		    scanCompleted = true;
		});
    }

    /**
     * Simple wrapper for a custom console using the default stdout/stderr
     * console
     */
    scanToStdConsole = function(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit,
	    callback) {
	// create default console
	const
	c = require('console');
	// wrap customer console scan
	scanToCustomConsole(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit, c, 1,
		callback);
    }

    /**
     * Method to perform a scan and write it to the specified console object.
     * Using this method should enable developers to create custom IO handlers
     */
    scanToCustomConsole = function(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart,
	    recordLimit, console, threads, callback) {
	var worker = function(record, wCallback) {
	    // decode the data stored in the table
	    var data = new Buffer(record.recordData.S, 'Base64').toString(intermediateEncoding);
	    // write to the supplied console
	    console.log(data);
	    wCallback();
	};
	var queue = async.queue(worker, threads);
	var scanCompleted = false;
	queue.drain = function() {
	    async.until(function() {
		return scanCompleted;
	    }, function(untilCallback) {
		setTimeout(function() {
		    untilCallback();
		}, 500);
	    }, function(err) {
		callback(err);
	    });
	};

	// scan through the stored archive using the supplied filters
	scanArchive(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit, queue,
		function(err) {
		    scanCompleted = true;
		});
    }
    /**
     * function interface to scan through the archive sequentially with the
     * potential filters provided
     */
    scanArchive = function(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit,
	    recordQueue, callback) {
	if (!recordQueue) {
	    callback("You must provide an Async.queue (https://caolan.github.io/async/docs.html#queue) to process records");
	} else {
	    var streamModeCache = {};
	    common.getArchiveSettingsForStream(streamName, streamModeCache, this.kinesisClient, true, function(err) {
		if (err) {
		    finalCallback(err);
		} else {
		    var tableName = streamModeCache[streamName].tableName;

		    // build up the filter conditions
		    var params = {
			TableName : tableName
		    };
		    if (recordLimit) {
			params.Limit = recordLimit;
		    }
		    // function to build the filter expression information based
		    // on
		    // what's supplied
		    var t = function(alias, filter, type) {
			if (filter) {
			    if (!params.FilterExpression) {
				if (!params.FilterExpression) {
				    params.FilterExpression = "";
				    params.ExpressionAttributeNames = {};
				    params.ExpressionAttributeValues = {};
				}
				params.FilterExpression += "#" + alias + " >= :" + alias + " ";
				params.ExpressionAttributeNames["#" + alias] = alias;
				params.ExpressionAttributeValues[":" + alias] = {};
				params.ExpressionAttributeValues[":" + alias][type] = filter;
			    }
			}
		    };

		    // process each filter that might have been provided - all
		    // are
		    // supported concurrently
		    t(sortKeyName, sequenceStart, 'S');
		    t(lastUpdateDateName, lastUpdateDateStart, 'S');
		    t(approximateArrivalName, approximateArrivalStart, 'N');

		    // issue the scan operation
		    var moreRecords = true;
		    async.whilst(function() {
			return moreRecords;
		    }, function(whilstCallback) {
			this.dynamoDB.scan(params, function(err, data) {
			    if (err) {
				whilstCallback(err);
			    } else {
				if (!data || !data.Items) {
				    moreRecords = false;
				    whilstCallback();
				} else {
				    // process each record
				    data.Items.map(function(item) {
					// invoke the provided per-record
					// callback
					recordQueue.push(item, function(err) {
					    if (err) {
						console.log(err);
					    }
					});
				    });

				    // process the output of the scan api so we
				    // know
				    // if we need to continue
				    if (!data.LastEvaluatedKey) {
					// this is the last page of query
					// results,
					// so mark that we are done to the async
					// iterator
					moreRecords = false;
				    } else {
					// more records to come, so bind this
					// key
					// into the exclusive start key for the
					// next
					// query
					params.ExclusiveStartKey = {
					    S : data.LastEvaluatedKey
					};
				    }

				    whilstCallback();
				}
			    }
			});
		    }, function(err) {
			if (callback) {
			    callback(err);
			}
		    });
		}
	    });
	}
    };

    /**
     * Simple wrapper for a custom console using the default stdout/stderr
     * console
     */
    queryToStdConsole = function(streamName, partitionKey, sequenceStart, sequenceEnd, recordLimit, threads, callback) {
	// create default console
	const
	c = require('console');
	// wrap customer console scan
	queryToCustomConsole(streamName, partitionKey, sequenceStart, sequenceEnd, recordLimit, 1, console, callback);
    }

    /**
     * Method to perform a query and write it to the specified console object.
     * Using this method should enable developers to create custom IO handlers
     */
    queryToCustomConsole = function(streamName, partitionKey, sequenceStart, sequenceEnd, recordLimit, threads,
	    customConsole, callback) {
	var worker = function(record, wCallback) {
	    // decode the data stored in the table
	    var data = new Buffer(record.recordData.S, 'Base64').toString(intermediateEncoding);
	    // write to the supplied console
	    customConsole.log(data);
	    wCallback();
	};
	var queue = async.queue(worker, threads);
	var queryCompleted = false;
	queue.drain = function() {
	    async.until(function() {
		return queryCompleted;
	    }, function(untilCallback) {
		setTimeout(function() {
		    untilCallback();
		}, 500);
	    }, function(err) {
		callback(err);
	    });
	};

	// query the stored archive using the supplied filters
	queryArchive(partitionKey, sequenceStart, sequenceEnd, recordLimit, queue, function(err) {
	    scanCompleted = true;
	});
    }

    /**
     * function to get or query the archive store with specific values
     */
    queryArchive = function(streamName, partitionKey, sequenceStart, sequenceEnd, recordLimit, recordQueue, callback) {
	var streamModeCache = {};
	common.getArchiveSettingsForStream(streamName, streamModeCache, this.kinesisClient, true, function(err) {
	    if (err) {
		callback(err);
	    } else {
		var tableName = streamModeCache[streamName].tableName;

		if (sequenceStart && sequenceEnd && sequenceStart == sequenceEnd) {
		    var params = {
			TableName : tableName,
			Key : {}
		    };
		    params.Key[partitionKeyName] = {
			S : partitionKey
		    };
		    // we're just going to fetch the requested record from the
		    // archive
		    if (streamModeCache[streamName][RECOVERY_MODE_TAG_NAME] == RECOVERY_MODE_ALL) {
			// add the sort key for the supplied sequence numbers if
			// all data is captured
			params.Key[sortKeyName] = {
			    S : sequenceStart
			};
		    } else {
			console.log("WARN: Sequence information supplied but archive mode is " + RECOVERY_MODE_LATEST);
		    }

		    this.dynamoDB.getItem(params, function(err, data) {
			if (err) {
			    callback(err);
			} else {
			    // call the per-record callback with the supplied
			    // final callback indicating we are done
			    recordQueue.push(data.Item, function(err) {
				if (err) {
				    console.log(err);
				}
			    });
			}
		    });
		} else {
		    // we'll implement a record query
		    var params = {
			TableName : tableName,
			Select : 'ALL_ATTRIBUTES',
			KeyConditionExpression : "#partitionKeyName = :partitionKey"
		    };
		    params.ExpressionAttributeNames = {
			"#partitionKeyName" : partitionKeyName
		    };
		    params.ExpressionAttributeValues = {
			":partitionKey" : {
			    S : partitionKey
			}
		    };
		    if (recordLimit) {
			params.Limit = recordLimit;
		    }
		    if (sequenceStart && sequenceEnd) {
			params.KeyConditionExpression += " and #sortKey between :sequenceStart and :sequenceEnd";
			params.ExpressionAttributeNames["#sortKey"] = sortKeyName;
			params.ExpressionAttributeValues[":sequenceStart"] = {
			    S : sequenceStart
			};
			params.ExpressionAttributeValues[":sequenceEnd"] = {
			    S : sequenceEnd
			};
		    } else {
			if (sequenceStart) {
			    params.KeyConditionExpression += " and #sortKey >= :sequenceStart";
			    params.ExpressionAttributeNames["#sortKey"] = sortKeyName;
			    params.ExpressionAttributeValues[":sequenceStart"] = {
				S : sequenceStart
			    };
			}

			if (sequenceEnd) {
			    params.KeyConditionExpression += " and #sortKey <= :sequenceEnd";
			    params.ExpressionAttributeNames["#sortKey"] = sortKeyName;
			    params.ExpressionAttributeValues[":sequenceEnd"] = {
				S : sequenceEnd
			    };
			}
		    }

		    if (debug) {
			console.log("Query Parameters: " + JSON.stringify(params));
		    }

		    var moreRecords = true;
		    async.whilst(function() {
			return moreRecords;
		    }, function(whilstCallback) {
			this.dynamoDB.query(params, function(err, data) {
			    if (err) {
				whilstCallback(err);
			    } else {
				// process each record
				data.Items.map(function(item) {
				    recordQueue.push(item, function(err) {
					if (err) {
					    console.log(err);
					}
				    });
				});

				if (!data.LastEvaluatedKey) {
				    // this is the last page of query results,
				    // so
				    // mark that we are done to the async
				    // iterator
				    moreRecords = false;
				} else {
				    // more records to come, so bind this key
				    // into
				    // the exclusive start key for the next
				    // query
				    params.ExclusiveStartKey = {
					S : data.LastEvaluatedKey
				    };
				}
				whilstCallback();
			    }
			});
		    }, function(err) {
			if (callback) {
			    callback(err);
			}
		    });
		}
	    }
	});
    };

    return this;
};