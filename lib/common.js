require("./constants");
var aws = require('aws-sdk');

function getTargetTablename(StreamName, archiveMode) {
    return StreamName + "-archive-" + archiveMode;
};
exports.getTargetTablename = getTargetTablename;

getTtlValue = function(seconds) {
    return Math.round(now() + seconds);
};
exports.getTtlValue = getTtlValue;

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

function now() {
    return new Date().getTime() / 1000;
};
exports.now = now;

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
};
exports.randomInt = randomInt;

function createTables(regionName, streamName, archiveMode, readIOPS, writeIOPS, ttlSeconds, callback) {
    var dynamoDB = new aws.DynamoDB({
	apiVersion : '2012-08-10',
	region : regionName
    });

    if (!streamName || !archiveMode || !readIOPS || !writeIOPS) {
	callback("Unable to create DynamoDB Table without configured values");
    } else {
	var tableName = exports.getTargetTablename(streamName, archiveMode);

	// create the base specification for the dynamo db table
	var compressStreamSpec = {
	    AttributeDefinitions : [ {
		AttributeName : partitionKeyName,
		AttributeType : 'S'
	    }, {
		AttributeName : "sequenceNumber",
		AttributeType : 'S'
	    } ],
	    KeySchema : [ {
		AttributeName : partitionKeyName,
		KeyType : 'HASH'
	    } ],
	    TableName : tableName,
	    ProvisionedThroughput : {
		ReadCapacityUnits : readIOPS,
		WriteCapacityUnits : writeIOPS
	    }
	};

	// add a sort key on sequence number for MODE = all
	if (archiveMode == RECOVERY_MODE_ALL) {
	    compressStreamSpec.KeySchema.push({
		AttributeName : sortKeyName,
		KeyType : 'RANGE'
	    });
	}

	console.log("Creating Table " + tableName + " in Dynamo DB");
	dynamoDB.createTable(compressStreamSpec, function(err, data) {
	    if (err) {
		if (err.code !== 'ResourceInUseException') {
		    console.log(Object.prototype.toString.call(err).toString());
		    console.log(err.toString());
		    callback(err.toString());
		} else {
		    console.log("OK - table already exists");
		}
	    }
	});

	if (ttlSeconds) {
	    var params = {
		TableName : tableName,
		TimeToLiveSpecification : {
		    AttributeName : ARCHIVE_ATTRIBUTE_NAME,
		    Enabled : true
		}
	    };

	    // wait until the table has been created
	    dynamoDB.waitFor('tableExists', {
		TableName : tableName
	    }, function(err, data) {
		if (err) {
		    console.log(err, err.stack);
		    callback(err);
		} else {
		    // set ttl values
		    dynamoDB.updateTimeToLive(params, function(err, data) {
			if (err) {
			    console.log(err, err.stack);
			    callback(err);
			} else {
			    console.log("TTL Enabled");
			    callback();
			}
		    });
		}
	    });
	}
    }
};
exports.createTables = createTables;

function getArchiveSettingsForStream(streamName, streamModeCache, kinesisClient, forceInvalidate, callback) {
    if ((!forceInvalidate || forceInvalidate === false) && streamName in streamModeCache) {
	// cache already includes the stream recovery information, so lets
	// go!
	if (callback) {
	    callback();
	}
    } else {
	console.log("Resolving Archive Mode for Stream " + streamName);

	// revalidate the cached values every N seconds
	setTimeout(getArchiveSettingsForStream, reValidateArchiveModeCacheSeconds * 1000, streamName, streamModeCache,
		kinesisClient, true, undefined);

	// query the stream's tags and resolve settings from there
	kinesisClient.listTagsForStream({
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
			var tag_values = item.Value.split("=");
			cacheEntry[ARCHIVE_TAG_TTL_SECONDS_NAME] = tag_values[1];
		    }
		});

		// set the default archive mode if needed
		if (!cacheEntry[RECOVERY_MODE_TAG_NAME]) {
		    console.log("Setting default Archive Mode 'latest'");
		    cacheEntry[RECOVERY_MODE_TAG_NAME] = RECOVERY_MODE_LATEST;
		}

		cacheEntry.tableName = getTargetTablename(streamName, cacheEntry[RECOVERY_MODE_TAG_NAME]);
		streamModeCache[streamName] = cacheEntry;

		// all set - lets go!
		if (callback) {
		    callback(null);
		}
	    }
	});
    }
};
exports.getArchiveSettingsForStream = getArchiveSettingsForStream;