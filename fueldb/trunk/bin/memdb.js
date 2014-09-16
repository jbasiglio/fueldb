/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

var db = {};
var reservedPoint = [".VALUE",".DATE",".USER"];

exports.read = function(path){
	var points = path.split(".");
	var point = db[points[0]];
	for(var i=1; i<points.length && point; i++){
		point = point[points[i]];
	}
	var obj = {
		value:(point && point[".VALUE"]) ? point[".VALUE"] : "",
		date:(point && point[".DATE"]) ? point[".DATE"] : "",
		user:(point && point[".USER"]) ? point[".USER"] : ""
	};
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

exports.write = function(path, value, user){
	var points = path.split(".");
	if(db[points[0]] == null){
		db[points[0]] = {};
	}
	var point = db[points[0]];
	for(var i=1; i<points.length; i++){
		if(point[points[i]] == null){
			point[points[i]] = {};
		}
		point = point[points[i]];
	}
	point[".VALUE"] = value;
	point[".DATE"] = new Date().toISOString();
    point[".USER"] = user;
};

exports.browse = function(path){
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
	return result;
};