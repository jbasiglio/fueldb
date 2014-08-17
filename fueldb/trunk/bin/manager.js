/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

var pushables = {};

exports.add = function(point, ws) {
	if (!pushables[point]) {
		pushables[point] = {};
	}
	pushables[point][ws.id] = ws;
};

exports.remove = function(point, ws) {
	if (pushables[point]) {
		delete pushables[point][ws.id];
	}
};

exports.removeAll = function(id) {
	for ( var point in pushables) {
		if (pushables[point][id]) {
			delete pushables[point][id];
		}
	}
};

exports.removeCascade = function(path) {
	for ( var point in pushables) {
		if (point === path || point.match(path+".*")) {
			delete pushables[point];
		}
	}
};

exports.update = function(point, value) {
	var already = [];
	for ( var key in pushables) {
		if(key.split(".").length !== point.split(".").length){continue;}
		var match = point.match(key);
		if(!match||(match.length !== 1)||match[0] !== point){continue;}
		for ( var id in pushables[key]) {
			if(already.indexOf(id)===-1){
				pushables[key][id].onPushed(value);
				already.push(id);
			}
		}
	}
	/*
	if (pushables[point]) {
		for ( var id in pushables[point]) {
			pushables[point][id].onPushed(value);
		}
	}
	*/
};