/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */
// var archive = require('./archive.js');
// var archivePoints = require('../conf/archive.json');
var KEY = require('./keys.json');
var groups = require('../conf/groups.json');
var db = {};
var reservedPoint = [];
for(var i in KEY){
	reservedPoint.push("."+KEY[i]);
}

// archive.init(function(){
// 	archivePoints.forEach(function(point){
// 		archive.read(point,function(value,apiKey,date){
// 			if(value && apiKey && date){
// 				writeNoArch(point,value,apiKey,date);
// 			}
// 		})
// 	});
// });

function getGroupsFromUser(apiKey){
	var values = [];
	for(var group in groups){
		if(groups[groups].indexOf(apiKey)>=0){
			values.push(group);
		}
	}
	return values;
}

function format(point){
	return {
		"value":(point && point["."+KEY.VALUE]) ? point["."+KEY.VALUE] : "",
		"apiKey":(point && point["."+KEY.MODIF_USER]) ? point["."+KEY.MODIF_USER] : "",
		"date":(point && point["."+KEY.MODIF_DATE]) ? point["."+KEY.MODIF_DATE] : ""
	};
}

exports.read = function(path,cb){
	var points = path.split(".");
	var point = db[points[0]];
	for(var i=1; i<points.length && point; i++){
		point = point[points[i]];
	}
	var obj = format(point);
	if(cb){
		cb(obj);
	}
	return obj;
};

exports.remove = function(path){
	var points = path.split(".");
	if(points.length === 1){
		delete db[points[0]];
		return;
	}
	var point = db[points[0]];
	for(var i=1; i<points.length-1 && point; i++){
		point = point[points[i]];
	}
	if(point[points[points.length-1]]){
		delete point[points[points.length-1]];
	}
};

function getPoint(path){
	var newPoint = false;
	var points = path.split(".");
	if(db[points[0]] === undefined){
		db[points[0]] = {};
		newPoint = true;
	}
	var point = db[points[0]];
	for(var i=1; i<points.length; i++){
		if(point[points[i]] === undefined){
			point[points[i]] = {};
			newPoint = true;
		}
		point = point[points[i]];
	}
	return [point, newPoint];
}

var writeNoArch = function(path, value, apiKey, now){
	var retVal = getPoint(path);
	var point = retVal[0];
	var newPoint = retVal[1];
	point["."+KEY.VALUE] = value;
	point["."+KEY.MODIF_USER] = apiKey;
	point["."+KEY.MODIF_DATE] = now.toISOString();
	if(newPoint){
		point["."+KEY.CREATE_USER] = apiKey;
		point["."+KEY.CREATE_DATE] = now.toISOString();
	}
};

exports.write = function(path, value, apiKey, now){
	if(!now){
		now = new Date();
	}
	writeNoArch(path, value, apiKey, now);
    // if(archivePoints.indexOf(path) !== -1){
	//     archive.insert(path,value,apiKey,now);
    // }
};

exports.browse = function(path,cb){
	var points = path.split(".");
	var point = points[0]=== "" ? db : db[points[0]];
	for(var i=1; i<points.length && point; i++){
		point = point[points[i]];
	}
	var result = [];
	for(var key in point){
		if(reservedPoint.indexOf(key) === -1){
			result.push(key);
		}
	}
	if(cb){
		cb(result);
	}
	return result;
};

// exports.readArchive = function(path,date,cb){
// 	archive.readOld(path,date,cb);
// };