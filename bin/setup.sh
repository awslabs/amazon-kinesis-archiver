#!/bin/bash

# Kinesis Streams to Firehose
# 
# Copyright 2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

function usage {
	echo "Please provide the Stream Name, the Archive Mode (all | latest), and the Region. You can also specify the TTL Interval in Seconds if data should automatically be deleted from DynamoDB."
	exit -1
}

function checkDep {
	which $1 > /dev/null 2>&1
	
	if [ $? != 0 ]; then
		echo "This utility requires the AWS Cli, which can be installed using instructions found at http://docs.aws.amazon.com/cli/latest/userguide/installing.html, as well as a node.js runtime"
		exit -2
	fi
}

if [ $# -lt 3 ]; then
	usage
fi

if [ $# -lt 3 ]; then
	if [ $# -gt 5 ]; then
		usage
	fi
fi

checkDep aws
checkDep node

if [[ $2 = "all" || $2 = "latest" ]]; then
	echo "Adding configuration tags to Kinesis Stream $1"
	aws kinesis add-tags-to-stream --stream-name $1 --tags StreamArchiveMode=$2 --region $3
	
	if [[ "$4" != "" ]]; then		
		aws kinesis add-tags-to-stream --stream-name $1 --tags ArchiveTTL=expireSeconds=$4 --region $3
	fi
	
	aws kinesis list-tags-for-stream --stream-name $1 --region $3
else
	usage
fi

# now go create the dynamo db table
node bin/createDynamoTable.js $1 $3 $2
