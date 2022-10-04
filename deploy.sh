#!/bin/bash
#set -x

ver=1.0.2

for r in `aws ec2 describe-regions --query Regions[*].RegionName --output text`; do aws s3 cp dist/amazon-kinesis-archiver-$ver.zip s3://awslabs-code-$r/AmazonKinesisArchiver/amazon-kinesis-archiver-$ver.zip --acl public-read --region $r; done
