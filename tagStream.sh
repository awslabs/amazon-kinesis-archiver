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
	echo "Please provide the Stream Name, the Archival Mode (all | latest), and the Region. You can also specify an attribute name to be used for Archival TTL and the TTL Seconds. If provided, then both are required."
	exit -1
}

if [ $# -lt 3 ]; then
	usage
fi

if [ $# -lt 3 ]; then
	if [ $# -gt 5 ]; then
		usage
	fi
fi

which aws > /dev/null 2>&1

if [ $? != 0 ]; then
	echo "This utility requires the AWS Cli, which can be installed using instructions found at http://docs.aws.amazon.com/cli/latest/userguide/installing.html"
	exit -2
fi

if [[ $2 = "all" || $2 = "latest" ]]; then
	aws kinesis add-tags-to-stream --stream-name $1 --tags StreamArchiveMode=$2 --region $3
	
	if [[ "$4" != "" ]]; then
		archive=attributeName=$4:expireSeconds=$5
		aws kinesis add-tags-to-stream --stream-name $1 --tags ArchiveTTL=$archive --region $3
	fi
	
	aws kinesis list-tags-for-stream --stream-name $1 --region $3
else
	usage
fi