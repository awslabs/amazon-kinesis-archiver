var readline = require('readline');
var async = require('async');
require("./constants");
var common = require("./common");
var aws = require('aws-sdk');
var ec2 = new aws.EC2({
    apiVersion : '2016-11-15',
    region : "us-east-1"
});

/* configuration of question prompts and config assignment */
var rl = readline.createInterface({
    input : process.stdin,
    output : process.stdout
});

var _streamName;
var _archiveMode;
var _tableName;
var _setRegion;
var _writeIOPS;
var _readIOPS;
var _ttlSeconds;

q_region = function(callback) {
    rl.question('Enter the Region for the Compressed Table > ', function(answer) {
	if (exports.blank(answer) !== null) {
	    ec2.describeRegions({}, function(err, data) {
		if (err) {
		    callback(err);
		} else {
		    // load all the regions
		    var regions = [];
		    data.Regions.map(function(item) {
			regions.push(item.RegionName);
		    });
		    exports.validateArrayContains(regions, answer.toLowerCase(), function(err) {
			if (err) {
			    callback(err);
			} else {
			    _setRegion = answer.toLowerCase();

			    callback(null);
			}
		    });
		}
	    });
	} else {
	    callback("You must provide a region");
	}
    });
};

q_streamName = function(callback) {
    rl.question('Enter the Stream Name > ', function(answer) {
	if (exports.blank(answer) !== null) {
	    _streamName = answer;

	    callback(null);
	} else {
	    callback("You must provide a Stream Name");
	}
    });
};

q_archiveMode = function(callback) {
    rl.question('Enter the Archive Mode required (all | latest) > ', function(answer) {
	if (!answer || (answer !== RECOVERY_MODE_LATEST && answer !== RECOVERY_MODE_ALL)) {
	    callback("Archive Mode must be one of " + RECOVERY_MODE_LATEST + " or " + RECOVERY_MODE_ALL);
	} else {
	    // set the table name & mode
	    _archiveMode = answer;
	    _tableName = common.getTargetTablename(_streamName, answer);
	    callback(null);
	}
    });
};

q_setTTL = function(callback) {
    rl.question('Should data expire from the archive table? If yes enter the interval to retain in seconds > ', function(answer) {
	if (!answer) {
	    callback(null);
	} else {
	    _ttlSeconds = parseInt(answer);
	    callback(null);
	}
    });
};

q_readIOPS = function(callback) {
    rl.question('How Many Read IOPS do you require? > ', function(answer) {
	if (exports.blank(answer) !== null) {
	    _readIOPS = exports.getIntValue(answer);

	    callback(null);
	} else {
	    callback("You must provide the required amount of Read IOPS");
	}
    });
};

q_writeIOPS = function(callback) {
    rl.question('How Many Write IOPS do you require? > ', function(answer) {
	if (exports.blank(answer) !== null) {
	    _writeIOPS = exports.getIntValue(answer);

	    callback(null);
	} else {
	    callback("You must provide the required amount of Write IOPS");
	}
    });
};

last = function(err, callback) {
    rl.close();

    if (err) {
	console.log(err);
    } else {
	common.createTables(_setRegion, _tableName, _archiveMode, _readIOPS, _writeIOPS, _ttlSeconds, function(err) {
	    if (err) {
		console.log(err);
		process.exit(ERROR);
	    } else {
		process.exit(OK);
	    }
	});
    }
};

exports.validateArrayContains = function(array, value, callback) {
    if (array.indexOf(value) == -1) {
	var err = 'Value must be one of ' + array.toString();
	callback(err);
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

qs = [ q_region, q_streamName, q_archiveMode, q_setTTL, q_readIOPS, q_writeIOPS ];

async.waterfall(qs, last);