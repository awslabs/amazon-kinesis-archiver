require("./constants");
var aws = require('aws-sdk');

exports.getTargetTablename = function(StreamName, archiveMode) {
    return StreamName + "-archive-" + archiveMode;
};

exports.createTables = function(regionName, tableName, archiveMode, readIOPS, writeIOPS, ttlSeconds, callback) {
    var dynamoDB = new aws.DynamoDB({
	apiVersion : '2012-08-10',
	region : regionName
    });

    if (!tableName || !archiveMode || !readIOPS || !writeIOPS) {
	callback("Unable to create DynamoDB Table without configured values");
    } else {
	// create the base specification for the dynamo db table
	var compressStreamSpec = {
	    AttributeDefinitions : [ {
		AttributeName : partitionKeyName,
		AttributeType : 'S'
	    }, {
		AttributeName : "sequenceNumber",
		AttributeType : 'S'
	    }, {
		AttributeName : "shardMagic",
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
	    },
	    GlobalSecondaryIndexes : [ {
		IndexName : tableName + "shardSeq",
		KeySchema : [ {
		    AttributeName : "shardMagic",
		    KeyType : 'HASH'
		}, {
		    AttributeName : "sequenceNumber",
		    KeyType : 'RANGE'
		} ],
		Projection : {
		    NonKeyAttributes : [ 'recordData', 'approximateArrivalTimestamp' ],
		    ProjectionType : 'INCLUDE'
		},
		ProvisionedThroughput : {
		    ReadCapacityUnits : readIOPS,
		    WriteCapacityUnits : writeIOPS
		}
	    } ]
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
		    AttributeName : ARCHIVE_DEFAULT_ATTRIBUTE_NAME,
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