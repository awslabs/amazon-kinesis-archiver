var readline = require('readline');
var aws = require('aws-sdk');
var async = require('async');

/* configuration of question prompts and config assignment */
var rl = readline.createInterface({
	input : process.stdin,
	output : process.stdout
});

var tableName;
var setRegion;
var writeIOPS;
var readIOPS;
var qs = [];
var dynamoDB;

q_region = function(callback) {
	rl.question('Enter the Region for the Compressed Table > ', function(answer) {
		if (exports.blank(answer) !== null) {
			exports.validateArrayContains([ "ap-northeast-1", "ap-southeast-1", "ap-southeast-2", "eu-central-1",
					"eu-west-1", "sa-east-1", "us-east-1", "us-west-1", "us-west-2" ], answer.toLowerCase(), rl);

			setRegion = answer.toLowerCase();

			// configure dynamo db and kms for the correct region
			dynamoDB = new aws.DynamoDB({
				apiVersion : '2012-08-10',
				region : setRegion
			});

			callback(null);
		}
	});
};

q_tableName = function(callback) {
	rl.question('Enter the Stream Name > ', function(answer) {
		if (exports.blank(answer) !== null) {
			tableName = answer + "-compressed";

			callback(null);
		}
	});
};

q_readIOPS = function(callback) {
	rl.question('How Many Read IOPS do you require? > ', function(answer) {
		if (exports.blank(answer) !== null) {
			readIOPS = exports.getIntValue(answer);

			callback(null);
		}
	});
};

q_writeIOPS = function(callback) {
	rl.question('How Many Write IOPS do you require? > ', function(answer) {
		if (exports.blank(answer) !== null) {
			writeIOPS = exports.getIntValue(answer);

			callback(null);
		}
	});
};

last = function(callback) {
	rl.close();

	exports.createTables();
};

exports.validateArrayContains = function(array, value, rl) {
	if (!(array.indexOf(value) > -1)) {
		rl.close();
		console.log('Value must be one of ' + array.toString());
		process.exit(INVALID_ARG);
	}
};

exports.blank = function(value) {
	if (value === '') {
		return null;
	} else {
		return value;
	}
};

exports.getIntValue = function(value, rl) {
	if (!value || value === null) {
		rl.close();
		console.log('Null Value');
		process.exit(INVALID_ARG);
	} else {
		var num = parseInt(value);

		if (isNaN(num)) {
			rl.close();
			console.log('Value \'' + value + '\' is not a Number');
			process.exit(INVALID_ARG);
		} else {
			return num;
		}
	}
};

exports.createTables = function() {
	// processed files table spec
	var partitionKey = 'partitionKey';
	var compressStreamSpec = {
		AttributeDefinitions : [ {
			AttributeName : partitionKey,
			AttributeType : 'S'
		} ],
		KeySchema : [ {
			AttributeName : partitionKey,
			KeyType : 'HASH'
		} ],
		TableName : tableName,
		ProvisionedThroughput : {
			ReadCapacityUnits : readIOPS,
			WriteCapacityUnits : writeIOPS
		}
	};

	console.log("Creating Table " + tableName + " in Dynamo DB");
	dynamoDB.createTable(compressStreamSpec, function(err, data) {
		if (err) {
			if (err.code !== 'ResourceInUseException') {
				console.log(Object.prototype.toString.call(err).toString());
				console.log(err.toString());
				process.exit(ERROR);
			}
		}
	});
};

qs.push(q_region);
qs.push(q_tableName);
qs.push(q_readIOPS);
qs.push(q_writeIOPS);

// always have to have the 'last' function added to halt the readline channel
// and run the setup
qs.push(last);

// call the first function in the function list, to invoke the callback
// reference chain
async.waterfall(qs);