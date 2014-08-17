/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

var config = require('../conf/config.json');
var crypto = require('crypto');
var users = require('../conf/users.json');

var pattern = new RegExp("^\\w+(\\.\\w+)*$");
var patternSub = new RegExp("^\\w+(\\.(\\w|\\*)+)*$");

exports.verifyHTTP = function(url,method){
	try{
		var user = url.query.user;
		var signature = url.query.signature;
		var check = url.href.split("&signature=")[0];
		var hash = crypto.createHmac('sha256',users[user]).update(check).digest('hex');
		return !(hash === signature);
	}catch(e){
		console.log(e);
		return true;
	}
	if(method !== "POST" && url.pathname === "/"){
		return true;
	}
	return false;
};

exports.verifyWS = function(obj,ws){

	if(config.login && obj.type === "login"){
		var hash = crypto.createHmac('sha256',obj.user).update(obj.password).digest('hex');
		obj.password = "";
		if(users[obj.user] === hash){
			ws.allowed = true;
			obj.point = ".LOGIN_SUCC";
			obj.value = obj.user;
		}else{
			obj.point = ".LOGIN_FAIL";
		}
		return obj;
	}

	if(config.login && !ws.allowed){
		obj.value = "You have to login first";
		obj.point = ".ERROR";
		return obj;
	}
	
	var test = !pattern.test(obj.point);
	var spec = !(obj.type === "browse" && obj.point === "");
	spec = spec && !(obj.type === "subscribe" && patternSub.test(obj.point));
	if(test && spec){
		obj.value = "Point " + obj.point + " is not allowed";
		obj.point = ".ERROR";
		return obj;
	}
	return false;
};

exports.computeBrokerURL = function(){
	var user = config.broker.user;
	var password = config.broker.password;
	var id = config.id;
	var toSign = "/?timestamp="+new Date().getTime()+"&user="+user+'&id='+id;
	var key = crypto.createHmac('sha256',user).update(password).digest('hex');
	var sign = crypto.createHmac('sha256',key).update(toSign).digest('hex');
	return toSign+"&signature="+sign;
};

exports.computeBalancerURL = function(){
	var user = config.balancer.user;
	var password = config.balancer.password;
	var id = config.id;
	var hosts = [];
	config.hosts.forEach(function(host){
		hosts.push(host.ssl+':'+host.host+':'+host.port);
	});
	var toSign = "/?timestamp="+new Date().getTime()+"&user="+user+'&id='+id+'&hosts='+hosts.join(',');
	var key = crypto.createHmac('sha256',user).update(password).digest('hex');
	var sign = crypto.createHmac('sha256',key).update(toSign).digest('hex');
	return toSign+"&signature="+sign;
};