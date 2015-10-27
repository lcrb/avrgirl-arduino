
function findNewCOMPort(before, after){
    for(var i = 0; i < after.length; i++){
        var comName = after[i].comName;
        var breaked = false;

        for(var j = 0; j < before.length; j++){
            var beforeComName = before[j].comName;

            if(comName == beforeComName){
                breaked = true;
                break;
            }
        }

        if(!breaked) return comName;
    }

    return null;
}

module.exports = findNewCOMPort;
