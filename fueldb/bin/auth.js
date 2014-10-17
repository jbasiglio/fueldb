/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */
var path = require("path");
var binDir = path.dirname(require.main.filename)+'/';
var config = require(binDir+'../conf/config.json');
var users = require(binDir+'../conf/users.json');
var crypto = require('crypto');


var pattern = new RegExp("^\\w+(\\.\\w+)*$");
var patternSub = new RegExp("^\\w+(\\.(\\w|\\*)+)*$");

var verifyURL = function(url){
    var user = url.query.user;
    if(!users[user]){
        throw "You are not allowed to connect";
    }
    var signature = url.query.signature;
    var check = url.href.split("&signature=")[0];
    var hash = crypto.createHmac('sha256',users[user]).update(check).digest('hex');
    if(hash !== signature){
        throw "You are not allowed to connect";
    }
};

exports.verifyHTTP = function(url,method){
    verifyURL(url);
    if(url.query.type !== "browse" && url.pathname === "/"){
        throw "Empty point is not allowed"
    }
};

exports.verifyWSURL = verifyURL;

exports.verifyWS = function(obj,ws){
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