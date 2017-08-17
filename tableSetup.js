var readline = require('readline');
var async = require('async');
require("./lib/constants");
var common = require("./lib/common");
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
var _setRegion;
var _writeIOPS;
var _readIOPS;
var _ttlSeconds;

q_region = function(callback) {
    rl.question('Enter the Region for the Archive Table > ', function(answer) {
	if (blank(answer) !== null) {
	    ec2.describeRegions({}, function(err, data) {
		if (err) {
		    callback(err);
		} else {
		    var regions = [];
		    data.Regions.map(function(item) {
			regions.push(item.RegionName);
		    });
		    validateArrayContains(regions, answer.toLowerCase(), function(err) {
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
	if (blank(answer) !== null) {
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
	    _archiveMode = answer;
	    callback(null);
	}
    });
};

q_setTTL = function(callback) {
    rl.question('Should data expire from the archive table? If yes enter the interval to retain in seconds > ',
	    function(answer) {
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
	if (blank(answer) !== null) {
	    _readIOPS = getIntValue(answer);

	    callback(null);
	} else {
	    callback("You must provide the required amount of Read IOPS");
	}
    });
};

q_writeIOPS = function(callback) {
    rl.question('How Many Write IOPS do you require? > ', function(answer) {
	if (blank(answer) !== null) {
	    _writeIOPS = getIntValue(answer);

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
	common.createTables(_setRegion, _streamName, _archiveMode, _readIOPS, _writeIOPS, _ttlSeconds, function(err) {
	    if (err) {
		console.log(err);
		process.exit(ERROR);
	    } else {
		process.exit(OK);
	    }
	});
    }
};

validateArrayContains = function(array, value, callback) {
    if (array.indexOf(value) == -1) {
	var err = 'Value must be one of ' + array.toString();
	callback(err);
    } else {
	callback();
    }
};

blank = function(value) {
    if (value === '') {
	return null;
    } else {
	return value;
    }
};

getIntValue = function(value, rl) {
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

exports.runSetup = function(streamName, region, archiveMode, readIOPS, writeIOPS, ttlSeconds, callback) {
    qs = [];

    if (!streamName || streamName === "") {
	qs.push(q_streamName);
    } else {
	_streamName = streamName;
    }
    if (!region || region === "") {
	qs.push(q_region);
    } else {
	_setRegion = region;
    }
    if (!archiveMode || archiveMode === "") {
	qs.push(q_archiveMode);
    } else {
	_archiveMode = archiveMode;
    }
    if (!ttlSeconds || ttlSeconds === "") {
	qs.push(q_setTTL);
    } else {
	_ttlSeconds = ttlSeconds;
    }
    if (!readIOPS || readIOPS === "") {
	qs.push(q_readIOPS);
    } else {
	_readIOPS = readIOPS;
    }
    if (!writeIOPS || writeIOPS === "") {
	qs.push(q_writeIOPS);
    } else {
	_writeIOPS = writeIOPS;
    }
    async.waterfall(qs, last);
};