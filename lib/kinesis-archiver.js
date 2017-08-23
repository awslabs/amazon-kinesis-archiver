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

module.exports = function (setRegion, kinesisClient, dynamoDB, overrideCache) {
    this.aws = require('aws-sdk');
    if (setRegion) {
        this.aws.config.update({
            region: region
        });
    } else {
        if (!setRegion || setRegion === null || setRegion === "") {
            this.aws.config.update({
                region: 'us-east-1'
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
                apiVersion: '2013-12-02',
                region: this.aws.config.region
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
                apiVersion: '2012-08-10',
                region: this.aws.config.region
            });
        }
    }
    if (overrideCache) {
        console.log("Applying Cache Override");

        this.streamModeCache = overrideCache;
    }

    console.log("AWS Kinesis Stream Archiver online in " + this.aws.config.region);

    init = function (streamName, forceInvalidate, callback) {
        common.getArchiveSettingsForStream(streamName, streamModeCache, this.kinesisClient, forceInvalidate, callback);
    };

    processRecords = function (streamName, event, callback) {
        var processor = processKinesisRecord.bind(undefined, streamName);

        async.map(event.Records, processor, function (err, results) {
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
                results.map(function (item) {
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
                    "event": event,
                    "status": status,
                    "message": message
                });
            }
        });
    };

    processKinesisRecord = function (streamName, record, completionCallback) {
        // lookup the stream vital details from the cache
        if (debug) {
            console.log("Cache Configuration");
            console.log(streamModeCache[streamName]);
        }
        var cacheEntry = streamModeCache[streamName];
        var archiveMode = cacheEntry[RECOVERY_MODE_TAG_NAME];
        var tableName = cacheEntry.tableName;

        var ttlSeconds;
        if (cacheEntry.hasOwnProperty(ARCHIVE_TAG_TTL_SECONDS_NAME)) {
            ttlSeconds = cacheEntry[ARCHIVE_TAG_TTL_SECONDS_NAME];
        }

        var partitionKey = record.kinesis.partitionKey;
        var seq = record.kinesis.sequenceNumber;
        var data = record.kinesis.data;
        var shardId = record.eventID.split(":")[0];

        if (debug) {
            console.log("Resoved event detail:");
            console.log({
                "partitionKey": partitionKey,
                "seq": seq,
                "tableName": tableName,
                "shardID": shardId,
                "data": data
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
            async
                .whilst(
                    function () {
                        // return OK if the proceed flag has
                        // been set, or if we've hit the
                        // retry count
                        return !proceed && tryNumber < retryLimit;
                    },
                    function (whilstCallback) {
                        tryNumber++;

                        // build the params for an atomic update of the
                        // object body
                        var shardMagic = shardId + "-" + common.randomInt(0, 99);
                        var item = {
                            Key: {},
                            TableName: tableName,
                            UpdateExpression: "set #lastUpdate = :updateTime, recordData = :data, shardId = :shardId, approximateArrivalTimestamp = :approxArrival",
                            ExpressionAttributeNames: {
                                "#lastUpdate": lastUpdateDateName
                            },
                            ExpressionAttributeValues: {
                                ":updateTime": {
                                    S: getFormattedDate(),
                                },
                                ":data": {
                                    S: data
                                },
                                ":shardId": {
                                    S: shardId
                                },
                                ":approxArrival": {
                                    N: "" + record.kinesis.approximateArrivalTimestamp
                                }
                            }
                        };

                        // set the primary key
                        item.Key[partitionKeyName] = {
                            S: partitionKey
                        };

                        if (archiveMode === RECOVERY_MODE_LATEST) {
                            /*
                             * sequence number must be lower or not
                             * found
                             */
                            item.ConditionExpression = "#seq < :sequence or attribute_not_exists(#seq)";

                            // add the sequence as update expressions to
                            // set the new
                            // value
                            item.UpdateExpression = item.UpdateExpression + ",#seq = :sequence";
                            item.ExpressionAttributeNames = {
                                "#seq": sortKeyName
                            };
                            item.ExpressionAttributeValues[":sequence"] = {
                                S: '' + seq
                            };
                        } else {
                            // RECOVERY_MODE_ALL uses the sequence as
                            // the sort key
                            item.Key[sortKeyName] = {
                                S: seq
                            };
                        }

                        // add ttl information
                        if (ttlSeconds) {
                            item.UpdateExpression = item.UpdateExpression + ", #ttlAttribute = :expireAfter";

                            if (item.ExpressionAttributeNames) {
                                item.ExpressionAttributeNames["#ttlAttribute"] = ARCHIVE_ATTRIBUTE_NAME;
                            } else {
                                item.ExpressionAttributeNames = {
                                    "#ttlAttribute": ARCHIVE_ATTRIBUTE_NAME
                                };
                            }
                            item.ExpressionAttributeValues[":expireAfter"] = {
                                N: "" + common.getTtlValue(ttlSeconds)
                            };
                        }

                        if (debug) {
                            console.log(JSON.stringify(item));
                        }

                        // update ddb
                        this.dynamoDB.updateItem(item, function (err, data) {
                            if (err) {
                                if (err.code === conditionCheckFailed) {
                                    /*
                                     * no problem - something wrote a
                                     * later record so we're done
                                     */
                                    if (debug) {
                                        console.log("Duplicate record with archive mode " + archiveMode
                                            + ". Continuing...");
                                    }
                                    proceed = true;
                                    whilstCallback();
                                } else if (err.code === provisionedThroughputExceeded) {
                                    console.log("Provisioned Throughput Exceeded - add Write IOPS!");

                                    // exponential backoff with 10ms
                                    // jitter
                                    setTimeout((50 * (2 ^ tryNumber)) + common.randomInt(0, 10),
                                        whilstCallback());
                                } else {
                                    asyncError = err;
                                    proceed = true;
                                    whilstCallback(err);
                                }
                            } else {
                                /*
                                 * no error - the body was updated on
                                 * the item
                                 */
                                proceed = true;
                                whilstCallback();
                            }
                        });
                    }, function (err) {
                        // function called when the async retry
                        // completes
                        if (err) {
                            completionCallback(err, null);
                        } else {
                            if (asyncError) {
                                // throw errors which were encountered
                                // during async
                                // calls
                                completionCallback(asyncError, null);
                            } else {
                                if (!proceed) {
                                    // we timed out while trying to
                                    // write the item to
                                    // ddb
                                    completionCallback(null, {
                                        status: ERROR,
                                        partitionKey: partitionKey,
                                        sequence: seq,
                                        msg: "Timeout while trying to update DDB"
                                    });
                                } else {
                                    // done ok
                                    completionCallback(null, {
                                        status: OK,
                                        partitionKey: partitionKey,
                                        sequence: seq,
                                        msg: null
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
                status: ERROR,
                partitionKey: partitionKey,
                sequence: seq,
                msg: null
            });
        }
    };

    return this;
};