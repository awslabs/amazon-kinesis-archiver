# Kinesis Stream Compressor

This Lambda function consumres data from an Amazon Kinesis Stream, and writes the event records to Amazon DynamoDB, retaining only the latest record by sequence number for the record Partition Key. This gives you the 'latest' picture of all events that happened on a Stream from when the compressor started running. The Kinesis record data is stored in DynamoDB as a Base 64 encoded string, and so will require deserialisation by the reading application in exactly the same way it would if being read from Kinesis directly. 

## Why would I want this?

If you ever wanted to replay a Stream for the purposes of rebuilding the 'latest' state of a system, then you would have to access the entire Stream forever. Given that Kinesis only stores data for a fixed period of time, this function would allow you to 'replay' the latest version of every event that ever happened on a Stream.

This functionality is inspired by the feature of Kafka Log Compaction https://cwiki.apache.org/confluence/display/KAFKA/Log+Compaction 


## DynamoDB Table Structure

The DynamoDB table is called ```MyKinesisStream-compressed```, and has the following structure:

* partitionKey - String - this is the partition key specified on the Kinesis PUT event
* lastSequence - String - this is the Kinesis Sequence Number of the last Record archived into the table for the partitionKey
* lastUpdate - String - Timestamp that the last archived record was written to DynamoDB
* recordData - String - Base64 encoded string value of the Kinesis record data

## How would I use this data once it's been captured?

In order to use the data stored in DynamoDB, you would run a SCAN operation (http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) against the table called ```MyKinesisStream-compressed```, and for each Item returned you would decode the ```recordData``` attribute which is stored as a String.

## Setup

In order to use this Lambda function, you must pre-create the Dynamo DB Table used to store the Stream Archive. To do this, run:

```
node createDynamoTable
```

which will prompt for AWS Region, Stream Name, and the required read and write IOPS. You should set the Write IOPS to Kinesis Open Shard Count * 1000 to ensure that the Stream compressor doesn't fall behind the 'head' of the Stream.

## Deploying

To deploy this functionality to AWS Lambda, create a new Lambda function using the [KinesisStreamCompressor-1.0.0.zip](dist/KinesisStreamCompressor-1.0.0.zip). Then, create a new Event Source Mapping for your function that references the desired Kinesis Stream to be archived. Please keep in mind that a single Lambda deployment can handle processing multiple Kinesis Streams, so you can create multiple event sources for a single function.

## Testing

You can test the module with ```test.js``` which allows you type in a dummy Kinesis Record Set and then allows running with ```node test```. 