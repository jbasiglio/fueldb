/**
 * New node file
 */
var KEY = require('./keys.json');

// if(!config.enable){
	exports.init = function(){};
	exports.insert = function(){};
	exports.read = function(path,cb){cb();};
	exports.readOld = function(path,date,cb){cb();};
	// return;
// }

// var MongoClient = require('mongodb').MongoClient;

// // Connection URL
// var url = 'mongodb://' + config.host + ':' + config.port + '/' + config.db;
// var collection;

// exports.init = function(cb){
// 	// Use connect method to connect to the Server
// 	MongoClient.connect(url, function(err, db) {
// 		if(err){
// 			console.log("An error happen while connecting to mongodb");
// 			console.log(err);
// 			return;
// 		}
// 		console.log("Connected correctly to server");
// 		collection = db.collection('archive');
// 		if(cb){
// 			cb();
// 		}
// 	});
// }

// function merge(path,value) {
// 	var obj = {};
// 	var init = obj;
// 	var keys = path.split(".");
// 	for(var key in keys){
// 		if(key === keys.length-1){
// 			obj[keys[key]] = value;
// 		}else{
// 			obj = (obj[keys[key]] = {});
// 		}
// 	}
// 	return init;
// }

// var insert = function(path,value,apiKey,date){
// 	if(collection){
// 		var data = {};
// 		data["@"+KEY.VALUE] = value;
// 		data["@"+KEY.MODIF_USER] = apiKey;
// 		data["@"+KEY.MODIF_DATE] = date;
// 		collection.insert(merge(path,data),function(err, docs){
			
// 		});
// 		return true;
// 	}
// 	return false;
// }

// exports.insert = insert;

// var read = function(path,cb){
// 	if(collection){
// 		var fullPath = (path+".@"+KEY.MODIF_DATE);
// 		var sort = {};
// 		sort[fullPath] = -1;
// 		collection.find().sort(sort).limit(1).toArray(function(err, docs) {
// 			if(!docs[0]){
// 				cb();
// 				return;
// 			}
// 			var data = docs[0];
// 			var paths = path.split(".");
// 			for(var part in paths){
// 				data = data[paths[part]];
// 			}
// 			if(data){
// 				cb(data["@"+KEY.VALUE],data["@"+KEY.MODIF_USER],data["@"+KEY.MODIF_DATE]);
// 			}else{
// 				cb();
// 			}
// 		});
// 	}else{
// 		cb();
// 	}
// }

// exports.read = read;

// var readOld = function(path,date,cb){
// 	if(collection){
// 		var fullPath = path+".@DATE";
// 		var sort = {};
// 		sort[fullPath] = -1;
// 		var filter = {};
// 		filter[fullPath] = {$lt: date};
// 		console.log(filter);
// 		collection.find(filter).sort(sort).limit(1).toArray(function(err, docs) {
// 			if(!docs[0]){
// 				cb();
// 				return;
// 			}
// 			var data = docs[0];
// 			var paths = path.split(".");
// 			for(var part in paths){
// 				data = data[paths[part]];
// 			}
// 			cb(data["@"+KEY.VALUE],data["@"+KEY.MODIF_USER],data["@"+KEY.MODIF_DATE]);
// 		});
// 	}else{
// 		cb();
// 	}
// }

// exports.readOld = readOld;