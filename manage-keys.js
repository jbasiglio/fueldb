#!/usr/bin/env node

/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

const fs = require('fs');
const crypto = require('crypto');
const program = require('commander');
const accessKeys = require('./conf/accessKeys.json');

program
	.version("1.0.0")
	.option('-i, --id', 'Access Key Id', false)
	.option('-s, --secret', 'Access Key Secret', false)
	.parse(process.argv);

var finalize = function () {
	console.log("Access Key Id: " + program.id)
	console.log("Access Key Secret: " + program.secret);
	accessKeys[program.id] = program.secret;
	fs.writeFileSync('conf/accessKeys.json', JSON.stringify(accessKeys, null, "\t"));
	console.log("The 'conf/accessKeys.json' file has been updated");
}

if (!program.id) {
	var key = Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase();
	program.id = key.slice(0, -2);
}

if (!program.secret) {
	crypto.randomBytes(40, function (err, buffer) {
		program.secret = buffer.toString('base64');
		finalize();
	});
} else {
	finalize();
}



