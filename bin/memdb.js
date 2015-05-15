/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */
var archive = require('./archive.js');
var archivePoints = require('../conf/archive.json');
var db = {};
var reservedPoint = [".VALUE",".DATE",".USER"];

archive.init(function(){
	archivePoints.forEach(function(point){
		archive.read(point,function(value,user,date){
			if(value && user && date){
				writeNoArch(point,value,user,date);
			}
		})
	});
});

function format(point){
	return {
		value:(point && point[".VALUE"]) ? point[".VALUE"] : "",
		user:(point && point[".USER"]) ? point[".USER"] : "",
		date:(point && point[".DATE"]) ? point[".DATE"] : ""
	};
}

function getPoint(path){
	var points = path.split(".");
	if(db[points[0]] === undefined){
		db[points[0]] = {};
	}
	var point = db[points[0]];
	for(var i=1; i<points.length; i++){
		if(point[points[i]] === undefined){
			point[points[i]] = {};
		}
		point = point[points[i]];
	}
	return point;
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

var writeNoArch = function(path, value, user, now){
	var point = getPoint(path);
	point[".VALUE"] = value;
	point[".USER"] = user;
	point[".DATE"] = now.toISOString();
};

exports.write = function(path, value, user){
	var point = getPoint(path);
	var now = new Date();
	point[".VALUE"] = value;
	point[".USER"] = user;
	point[".DATE"] = now.toISOString();
    if(archivePoints.indexOf(path) !== -1){
	    archive.insert(path,value,user,now);
    }
};

exports.browse = function(path,cb){
	var points = path.split(".");
	var point = points[0]==="" ? db : db[points[0]];
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

exports.readArchive = function(path,date,cb){
	archive.readOld(path,date,cb);
};