#!/bin/bash

version=`cat package.json | grep version | cut -d: -f2 | sed -e "s/\"//g" | sed -e "s/ //g" | sed -e "s/\,//g"`

functionName=KinesisStreamCompressor
filename=$functionName-$version.zip
region=eu-west-1

rm $filename 2>&11 >> /dev/null

zip -r $filename index.js package.json node_modules/ README.md LICENSE.txt && mv -f $filename dist/$filename

aws lambda update-function-code --function-name $functionName --zip-file fileb://dist/$filename --region $region