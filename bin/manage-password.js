/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

var fs = require('fs');
var crypto = require('crypto');
var users = require('../conf/users.json');
if(!(process.argv[2] && process.argv[3])){
	console.log("Usage: 'node manage-password {username} {password}'");
	exit(1);
}
var user = process.argv[2];
var password = process.argv[3];
console.log("User: "+user+" Password: "+password);
var hash = crypto.createHmac('sha256',user).update(password).digest('hex');
users[user] = hash;
fs.writeFileSync('../conf/users.json', JSON.stringify(users, null, "\t"));
console.log("The 'conf/users.json' file has been updated");