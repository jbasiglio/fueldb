/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */
var accessKeys = require('../conf/accessKeys.json');
var crypto = require('crypto');


var pattern = new RegExp("^\\w+(\\.\\w+)*$");
var patternSub = new RegExp("^\\w+(\\.(\\w|\\*)+)*$");

var verifyURL = function(url){
    var apiKey = url.query.apiKey;
    if(!accessKeys[apiKey]){
        throw new Error("You are not allowed to connect");
    }
    var signature = url.query.signature;
    var timestamp = url.query.timestamp;
    // if(new Date().getTime() - parseInt(timestamp) > 2000){
    //     throw new Error("You are not allowed to connect");
    // }
    var check = url.href.split("&signature=")[0];
    var hash = crypto.createHmac('sha256',accessKeys[apiKey]).update(check).digest('hex');
    if(hash !== signature){
        throw new Error("You are not allowed to connect");
    }
};

exports.verifyHTTP = function(url,method){
    verifyURL(url);
    if(url.query.type !== "browse" && url.pathname === "/"){
        throw new Error("Empty point is not allowed");
    }
};

exports.verifyWSURL = verifyURL;

exports.verifyWS = function(obj,ws){
    var test = !pattern.test(obj.point);
    var spec = !(obj.type === "browse" && obj.point === "");
    spec = spec && !(obj.type === "subscribe" && patternSub.test(obj.point));
    if(test && spec){
        throw new Error("Point '" + obj.point + "' is not allowed");
    }
};