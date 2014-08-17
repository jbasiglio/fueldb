/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

var config = require('../conf/config.json');
var dbpath = config.dbpath;
var fs = require('fs');

var reservedPoint = [".VALUE",".DATE"];

var buildPath = function(path){
	return dbpath+"/"+path.split(".").join("/");
};

var removeRec = function(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) {
                removeRec(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

var createRec = function(point) {
	var dirs = point.split(".");
	var path = dbpath;
	for(var key in dirs){
		path += "/"+dirs[key];
		if( !fs.existsSync(path) ) {
			fs.mkdirSync(path);
		}
	}
	return path;
};

exports.read = function(path){
	path = buildPath(path)+"/value.json";
	var value = null;
	var date = null;
	if( fs.existsSync(path) ) {
		value = fs.readFileSync(path,'utf8');
		date = fs.statSync(path).mtime;
	}
	var obj = {};
	obj.value = value ? JSON.parse(value) : "";
	obj.date = date ? date : "";
	return obj;
};

exports.remove = function(path){
	path = buildPath(path);
	removeRec(path);
};

exports.write = function(path, value){
	path = createRec(path);
	fs.writeFile(path+"/value.json", JSON.stringify(value), function(err) {
		if (err) {
			console.log(err);
		}
	});
};

exports.browse = function(path){
	var points = [];
	path = buildPath(path);
	if( fs.existsSync(path) ) {
		var files = fs.readdirSync(path);
	    files.forEach(function(file,index){
	        var curPath = path + "/" + file;
	        if(fs.lstatSync(curPath).isDirectory()) {
	        	points.push(file);
	        }
	    });
	}
    return points;
};

/*
exports.toString = function(){
	return JSON.stringify(db);
};
*/