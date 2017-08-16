# Kinesis Stream Archiver

Amazon Kinesis provides a family of services for working with streaming data at any scale. Kinesis Streams enables you to build custom applications that process or analyze streaming data for specialized needs. By default, Records of a Stream are accessible for up to 24 hours from the time they are added to the Stream. You can raise this limit to up to 7 days by enabling extended data retention.

Some customers have the need to be able to reprocess data that is significantly older than the Stream retention period, and have asked us for a way to archive data, and to provide the ability to 'replay' data into the stream for subsequent processing. Customers have also said that they want the ability to use Kinesis Streams for a 'unified log' or 'log oriented' architecture. In this model, customers may use a stream to build a 'database' of changes carried by the stream, and would like to be able to efficiently consume the sum total or final copies of log messages quickly and easily.

This module, built in AWS Lambda, gives you the ability to accomplish many of the above requirements, without having to run additional server infrastructure. It consumes data from an Amazon Kinesis Stream, and writes event records to Amazon DynamoDB. When it does this, you can choose whether it keeps all data received, or only the latest record by sequence number for the record Partition Key. You can then use programmatic API's in your software to query or replay data into the original or alternative Kinesis Streams.

![AmazonKinesisArchiver](AmazonKinesisArchiver.png)

## Creating a Stream archive

To get started with this module, simply deploy the function, and mapping to a Kinesis Stream, via the [AWS SAM](https://github.com/awslabs/serverless-application-model) templates below:

| |
| --------------------------|
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ap-south-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ap-south-1.amazonaws.com/awslabs-code-ap-south-1/AmazonKinesisArchiver/deploy.yaml) in ap-south-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-eu-west-2.amazonaws.com/awslabs-code-eu-west-2/AmazonKinesisArchiver/deploy.yaml) in eu-west-2 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-eu-west-1.amazonaws.com/awslabs-code-eu-west-1/AmazonKinesisArchiver/deploy.yaml) in eu-west-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-2#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ap-northeast-2.amazonaws.com/awslabs-code-ap-northeast-2/AmazonKinesisArchiver/deploy.yaml) in ap-northeast-2 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ap-northeast-1.amazonaws.com/awslabs-code-ap-northeast-1/AmazonKinesisArchiver/deploy.yaml) in ap-northeast-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=sa-east-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-sa-east-1.amazonaws.com/awslabs-code-sa-east-1/AmazonKinesisArchiver/deploy.yaml) in sa-east-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ca-central-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ca-central-1.amazonaws.com/awslabs-code-ca-central-1/AmazonKinesisArchiver/deploy.yaml) in ca-central-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ap-southeast-1.amazonaws.com/awslabs-code-ap-southeast-1/AmazonKinesisArchiver/deploy.yaml) in ap-southeast-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=ap-southeast-2#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-ap-southeast-2.amazonaws.com/awslabs-code-ap-southeast-2/AmazonKinesisArchiver/deploy.yaml) in ap-southeast-2 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=eu-central-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-eu-central-1.amazonaws.com/awslabs-code-eu-central-1/AmazonKinesisArchiver/deploy.yaml) in eu-central-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-us-east-1.amazonaws.com/awslabs-code-us-east-1/AmazonKinesisArchiver/deploy.yaml) in us-east-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-us-east-2.amazonaws.com/awslabs-code-us-east-2/AmazonKinesisArchiver/deploy.yaml) in us-east-2 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=us-west-1#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-us-west-1.amazonaws.com/awslabs-code-us-west-1/AmazonKinesisArchiver/deploy.yaml) in us-west-1 |
| [<img src="https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png" target="_blank">](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/new?stackName=AmazonKinesisArchiver&templateURL=https://s3-us-west-2.amazonaws.com/awslabs-code-us-west-2/AmazonKinesisArchiver/deploy.yaml) in us-west-2 |

When creating the Stack, you must supply a Stream ARN, which is the identity for the Kinesis Stream that should be archived, and the Stream Position, which can be one of:

|Setting |Start Position |
| ----|---|
| TRIM_HORIZON | The system will start archiving from the earliest record available, based on the Stream's retention policy) |
| LATEST | The system will start archiving from the next record ingested after the Kinesis Event Source is created and the function deployed |

Once done, you will see that you have a new Lambda function deployed, with name `<Stack Name>-StreamProcessor-<Unique ID>`, and this function will have an Event Source created for the indicated Kinesis Stream.

## Configuring the Archive Mode

Now that the funciton is set up, we need to tell it how data should be archived. Unfortunately we can't yet do this through AWS SAM, so we'll use the `tagStream.sh` script. The Kinesis Archiver knows how to archive data based on Tags that are placed on the source stream, which enables a single function to archive a virtually unlimited number of Kinesis Streams. To set the archive mode, simply run:

`./setup <Stream Name> <Archive Mode> <region>` with the following options:

* Stream Name - the Name of the Kinesis Stream in the specified Region. Please note this is not the Stream ARN used previously
* Archive Mode - one of `ALL` or `LATEST`. Archive Mode `ALL` will create a full record of all messages from the Stream. `LATEST` will only keep the last copy of a message on the basis of the supplied Stream Partition Key value
* Region - the region where the Kinesis Stream is deployed

Once done, you will be asked a series of questions about how the Archive should be stored in DynamoDB.

_Please note that this script requires that you have the [AWS Command Line Interface](https://aws.amazon.com/cli), and a node.js runtime installed on your system_.

## What happens now?

The The DynamoDB table is called ```MyKinesisStream-archive-<MODE>```, where `<MODE>` is one of `ALL` or `LATEST`.

This table has the following structure:

* `partitionKey` - String - this is the partition key specified on the Kinesis PUT event
* `sequenceNumber` - String - this is the Kinesis Sequence Number of the last Record archived into the table for the partitionKey
* `lastUpdate` - String - Timestamp that the last archived record was written to DynamoDB
* `recordData` - String - Base64 encoded string value of the Kinesis record data
* `approximateArrivalTimestamp` - Long - Timestamp expressed as epoch seconds when the message was recieved by Amazon Kinesis
* `shardId` - String - the Shard ID from which the message was received


## Automatically expiring data

The Kinesis Archiver has the ability to automatically remove data from the Stream Archive using the [DynamoDB Time To Live (TTL)](http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html) feature. When used, it will automatically delete data from DynamoDB based on attribute:

* `expireAfter` - Long - the timestamp expressed as epoch seconds after which the entry in DynamoDB may be expired by the TTL management process

To take advantage of the TTL feature, you can supply two additional parameters to the `tagStream.sh` command line script:

* 

## Querying data from an archive

## Replaying records from an archive


## How would I use this data once it's been captured?

In order to use the data stored in DynamoDB, you would run a [SCAN operation] (http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) against the table called ```MyKinesisStream-compressed```, and for each Item returned you would decode the ```recordData``` attribute which is stored as a String.

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