/*
		Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/asl/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License. 
 */

var lambda = require('./index');

var event = {
	"Records" : [
			{
				"kinesis" : {
					"kinesisSchemaVersion" : "1.0",
					"partitionKey" : "-48903309263388366",
					"sequenceNumber" : "49550822123942288925422195661801699673398497972964035234",
					"data" : "MzcxICgxZikgdHMtMTQzNTczODI4ODkxOSA1Ni4zNjM5MTkwNzg3ODk0NXgtMS42NDA1NjI4ODM3NDE1MjAzIDEwOS45NzkzOTQwMzc4NDA1NSBhdCAxNi4xMjMyNjMyOTY0NjM2MDUgVDoyLjIxMTY3MjU2ODE0NTYwNDQgYzogIDAuMDAxMTk0IGRlZyAgMC4wMDAwMDE="
				},
				"eventSource" : "aws:kinesis",
				"eventVersion" : "1.0",
				"eventID" : "shardId-000000000176:49550822123942288925422195661801699673398497972964035234",
				"eventName" : "aws:kinesis:record",
				"invokeIdentityArn" : "arn:aws:iam::887210671223:role/LambdaExecRole",
				"awsRegion" : "eu-west-1",
				"eventSourceARN" : "arn:aws:kinesis:eu-west-1:887210671223:stream/EnergyPipelineSensors"
			},
			{
				"kinesis" : {
					"kinesisSchemaVersion" : "1.0",
					"partitionKey" : "3388323060863249599",
					"sequenceNumber" : "49550822123942288925422195661802908599218112602138741410",
					"data" : "NDQgKDYpIHRzLTE0MzU3MzgyOTEwNDYgNTIuMzcyNjA1NDcwOTMxMzc2eC0wLjM5NzEwMzQxMDY2MDkzMjYgMTEwLjkwNTU3MDk1MDcyNDE4IGF0IDE2LjE2ODI3MTY0NDI3MDI5NSBUOjEuNTU2MjY3Nzk3NTczOTAwNSBjOiAgMC4wMDA5MTkgZGVnICAwLjAwMDAwMQ=="
				},
				"eventSource" : "aws:kinesis",
				"eventVersion" : "1.0",
				"eventID" : "shardId-000000000176:49550822123942288925422195661802908599218112602138741410",
				"eventName" : "aws:kinesis:record",
				"invokeIdentityArn" : "arn:aws:iam::887210671223:role/LambdaExecRole",
				"awsRegion" : "eu-west-1",
				"eventSourceARN" : "arn:aws:kinesis:eu-west-1:887210671223:stream/EnergyPipelineSensors"
			} ]
};

function context() {
}
context.done = function(status, message) {
	console.log("Context Closure Message: " + JSON.stringify(message));

	if (status && status !== null) {
		console.log('ERROR');
		process.exit(-1);
	} else {
		process.exit(0);
	}
};
context.success = function(message) {
	done(null, message);
}
context.fail = function(err) {
	done(err, err.message);
}

// run the lambda function
lambda.handler(event, context);