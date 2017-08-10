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

    console.log("AWS Kinesis Stream Archive Query Engine online in " + this.aws.config.region);

    /**
     * function interface to scan through the archive sequentially with the
     * potential filters provided
     */
    scanArchive = function(streamName, sequenceStart, lastUpdateDateStart, approximateArrivalStart, recordLimit,
	    recordCallback, finalCallback) {
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
		    params.Limit = limit;
		}
		// function to build the filter expression information based on
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
		}

		// process each filter that might have been provided - all are
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
			    // process each record
			    data.Items.map(function(item) {
				recordCallback(null, item);
			    });

			    if (!data.LastEvaluatedKey) {
				// this is the last page of query results,
				// so mark that we are done to the async
				// iterator
				moreRecords = false;
			    } else {
				// more records to come, so bind this key
				// into the exclusive start key for the next
				// query
				params.ExclusiveStartKey = {
				    S : data.LastEvaluatedKey
				};
			    }
			    whilstCallback();
			}
		    });
		}, function(err) {
		    if (err) {
			finalCallback(err);
		    } else {
			finalCallback();
		    }
		});
	    }
	});
    };

    /**
     * function to get or query the archive store with specific values
     */
    queryArchive = function(streamName, partitionKey, sequenceStart, sequenceEnd, recordLimit, recordCallback,
	    finalCallback) {
	var streamModeCache = {};
	common.getArchiveSettingsForStream(streamName, streamModeCache, this.kinesisClient, true, function(err) {
	    if (err) {
		finalCallback(err);
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
			// all
			// data is captured
			params.Key[sortKeyName] = {
			    S : sequenceStart
			};
		    } else {
			console.log("WARN: Sequence information supplied but archive mode is " + RECOVERY_MODE_LATEST);
		    }

		    this.dynamoDB.getItem(params, function(err, data) {
			if (err) {
			    finalCallback(err);
			} else {
			    // call the per-record callback with the supplied
			    // final callback indicating we are done
			    recordCallback(null, data.Item);
			    finalCallback();
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
				    recordCallback(null, item);
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
			if (err) {
			    finalCallback(err);
			} else {
			    finalCallback();
			}
		    });
		}
	    }
	});
    };

    return this;
};