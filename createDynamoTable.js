var tableSetup = require('./tableSetup');

var getArgSafe = function(index) {
    if (process.argv.length >= index + 1) {
	return process.argv[index];
    } else {
	return undefined;
    }
}

if (process.argv.length == 2) {
    tableSetup.runSetup();
} else {
    // map command line arguments
    tableSetup.runSetup(getArgSafe(2), getArgSafe(3), getArgSafe(4), getArgSafe(5), getArgSafe(6), getArgSafe(7));
}