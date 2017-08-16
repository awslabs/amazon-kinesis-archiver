#!/bin/bash

version=`cat package.json | grep version | cut -d: -f2 | sed -e "s/\"//g" | sed -e "s/ //g" | sed -e "s/\,//g"`

functionName=amazon-kinesis-archiver
filename=$functionName-$version.zip

rm $filename 2>&11 >> /dev/null

zip -r $filename index.js package.json lib/ node_modules/ README.md LICENSE.txt && mv -f $filename dist/$filename