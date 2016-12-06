function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function getDebug(debug) {
    if (isFunction(debug)) {
        return debug;
    } else if (debug) {
        return console.log.bind(console);
    } else {
        return function() {};
    }
}


module.exports = getDebug;
