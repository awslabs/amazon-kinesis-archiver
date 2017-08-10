function getFormattedDate(date) {
    if (!date) {
	date = new Date();
    }

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
};
exports.getFormattedDate = getFormattedDate;

function now() {
    return new Date().getTime() / 1000;
};
exports.now = now;

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
};
exports.randomInt = randomInt;