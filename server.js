#!/usr/bin/env node

/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

/** 
 *  Initial import
 */
const path = require("path");
//process.chdir(path.dirname(require.main.filename)+'/..');
const manager = require('./bin/manager.js');
const uid = require('./bin/uid.js');
const package = require('./package.json');
const auth = require('./bin/auth.js');
const db = require('./bin/memdb.js');
const bodyParser = require('body-parser')
const net = require('net');
var tls = require('tls')
const os = require("os");
const fs = require('fs');
const urlParse = require('url');
const qs = require('querystring');
const http = require('http');
const https = require('https');
const cors = require('cors');
const express = require('express');
const program = require('commander');

var functions = {};

var cpus = os.cpus();

program
	.version(package.version)
	.option('-p, --port [8101]', 'HTTP port', process.env.HTTP_PORT ? process.env.HTTP_PORT : '8101')
	.option('-s, --socketPort', 'TCP Socket port', process.env.TCP_PORT ? process.env.TCP_PORT : false)
	.parse(process.argv);

// var clustFct = ["set","remove"];

var WS_STATE = {};
WS_STATE.CONNECTING = 0;
WS_STATE.OPEN = 1;
WS_STATE.CLOSING = 2;
WS_STATE.CLOSED = 3;

var HTTP_METHOD = {};
HTTP_METHOD.GET = "read";
HTTP_METHOD.PUT = "set";
HTTP_METHOD.DELETE = "remove";
HTTP_METHOD.GET_BROWSE = "browse";
// HTTP_METHOD.GET_ARCHIVE = "readArchive";

const app = express();
var expressWs = require('express-ws')(app);

app.use(cors());
app.use('/static', express.static('static'))

app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'text/plain' }));

app.use('/rest', function (request, response, next) {
	var url = urlParse.parse(request.url, true);
	try {
		auth.verifyHTTP(url, request.method);
	} catch (e) {
		response.status(403)
		response.json({ "error": e.message });
		return;
	}
	next();
});

app.use('/rest', function (request, response) {
	var url = urlParse.parse(request.url, true);
	if (request.method === "GET" && url.query.type === "browse") {
		request.method = "GET_BROWSE";
	}
	// else if (request.method === "GET" && url.query.type === "archive") {
	// 	request.method = "GET_ARCHIVE";
	// }
	var path = url.pathname.split("/");
	path = path.slice(1, path.length).join(".");
	var obj = { point: path };
	obj.apiKey = url.query.apiKey;
	obj.date = url.query.date;
	obj.value = request.body;
	response.onPushed = function (obj) {
		response.status(200);
		if (obj) {
			response.json(obj);
		} else {
			response.end();
		}
	}
	functions[HTTP_METHOD[request.method]](obj, response);
});

app.ws("/ws", function (ws, req, next) {
	var url = urlParse.parse(req.url, true);
	if (url.href.indexOf("/ws/.websocket") == 0) {
		url.href = "/" + url.href.substring(14)
	}
	try {
		auth.verifyWSURL(url)
	} catch (e) {
		ws.close(4403, e + "");
		return;
	}
	next();
});

app.ws("/ws", function (ws, req) {
	var url = urlParse.parse(req.url, true);
	ws.id = uid.gen();
	ws.apiKey = url.query.apiKey;
	console.log("Connection open: " + ws.id);
	_updateConnection(true);
	ws.onPushed = function (msg) {
		if (ws.readyState === WS_STATE.OPEN){
			_updateIOPS();
			ws.send(JSON.stringify(msg));
		}
	};
	ws.on('message', function (message) {
		_updateIOPS();
		var obj = JSON.parse(message);
		obj.apiKey = ws.apiKey;
		obj.point = obj.point ? obj.point.trim() : "";
		try {
			auth.verifyWS(obj)
		} catch (e) {
			ws.onPushed({ point: ".ERROR", value: e.message });
			return;
		}

		if (obj.type in functions && typeof functions[obj.type] === "function") {
			// if(wscBroker && clustFct.indexOf(obj.type) !== -1){
			// 	wscBroker.dispatch(message);
			// }
			functions[obj.type](obj, ws);
		}
	});
	ws.on('error', function (message) {
		console.log("Error: " + message);
	});
	ws.on('close', function (code, message) {
		console.log("Connection lost: " + ws.id);
		_updateConnection(false);
		manager.removeAll(ws.id);
	});
});

var _socketRequestHandle = function (socket) {
	socket.id = uid.gen();
	console.log("Connection open: " + socket.id);
	_updateConnection(true);
	socket.onPushed = function (msg) {
		_updateIOPS();
		socket.write(JSON.stringify(msg) + '\3'); //End Of Text (EOT)
	};
	socket.on('data', function (message) {
		var messages = message.toString('utf8');
		messages.split('\3').forEach(function (msg) {
			if (msg == null || msg == "") {
				return;
			}
			_updateIOPS();
			var obj;
			try {
				obj = JSON.parse(msg);
			} catch (ex) {
				socket.onPushed({ point: ".ERROR", value: "Message format is not correct" });
				return;
			}
			obj.point = obj.point ? obj.point.trim() : "";
			try {
				auth.verifyWS(obj)
			} catch (e) {
				ws.onPushed({ point: ".ERROR", value: e.message });
				return;
			}
			if (obj.type in functions && typeof functions[obj.type] === "function") {
				// if(wscBroker && clustFct.indexOf(obj.type) !== -1){
				// 	wscBroker.dispatch(message);
				// }
				functions[obj.type](obj, socket);
			}
		})
	});
	socket.on('error', function (message) {
		console.log("Error: " + message);
	});
	socket.on('close', function (code, message) {
		console.log("Connection lost: " + socket.id);
		_updateConnection(false);
		manager.removeAll(socket.id);
	});
};

var _updatePoint = function (point, value) {
	var obj = {};
	obj.type = "set";
	obj.point = point;
	obj.value = value;
	obj.apiKey = "system";
	functions.set(obj);
};

functions.subscribe = function subscribe(obj, ws) {
	manager.add(obj.point, ws);
	var tmp = db.read(obj.point);
	obj.old = {};
	obj.old.value = "";
	obj.old.date = "";
	obj.value = tmp.value;
	obj.date = tmp.date;
	ws.onPushed(obj);
};

functions.unsubscribe = function unsubscribe(obj, ws) {
	manager.remove(obj.point, ws);
};

functions.set = function set(obj, ws) {
	obj.old = db.read(obj.point);
	var now = new Date();
	db.write(obj.point, obj.value, obj.apiKey, now);
	if (ws) {
		ws.onPushed(obj);
		obj.wsId = ws.id;
	}
	delete obj.id;
	delete obj.type;
	obj.date = now.toISOString();
	manager.update(obj.point, obj);
};

functions.read = function read(obj, ws) {
	delete obj.apiKey;
	var tmp = db.read(obj.point);
	obj.value = tmp.value;
	obj.date = tmp.date;
	obj.apiKey = tmp.apiKey;
	if (ws) {
		ws.onPushed(obj);
	} else {
		return obj;
	}
};

// functions.readArchive = function readArchive(obj, ws) {
// 	delete obj.apiKey;
// 	db.readArchive(obj.point, new Date(obj.date), function (value, apiKey, date) {
// 		obj.value = value;
// 		obj.apiKey = apiKey;
// 		obj.date = date;
// 		if (ws) {
// 			ws.onPushed(obj);
// 		}
// 	})
// };

functions.browse = function browse(obj, ws) {
	delete obj.apiKey;
	obj.value = db.browse(obj.point);
	if (ws) {
		ws.onPushed(obj);
	} else {
		return obj;
	}
};

functions.remove = function remove(obj, ws) {
	db.remove(obj.point);
	manager.removeCascade(obj.point);
};

app.listen(program.port);
console.log('Listening for HTTP/WS on port ' + program.port);

if (program.socketPort) {
	var server = net.createServer(_socketRequestHandle);
	server.listen(program.socketPort, "0.0.0.0", function () { //'listening' listener
		console.log('Listening to socket on port ' + program.socketPort);
	});
}

//****** Performance ******//

//****** CPU Load ******//
setInterval(function () {
	var avg = os.loadavg();
	var avgCpu = {
		"1": (avg[0] / cpus.length) * 100,
		"5": (avg[1] / cpus.length) * 100,
		"15": (avg[2] / cpus.length) * 100
	};
	_updatePoint("fueldb.cpu.load", avgCpu);
}, 5000);

//****** Current Connections ******//
var _updateConnection = function (inc) {
	var count = db.read("fueldb.connection").value;
	if (!count) {
		count = 0;
	}
	count += (inc ? 1 : -1);
	_updatePoint("fueldb.connection", count);
};

//****** IOPS ******//
var iops = 0;
var _updateIOPS = function () {
	iops++;
};
setInterval(function () {
	_updatePoint("fueldb.iops", iops + "");
	iops = 0;
}, 1000);

//****** Version ******//
_updatePoint("fueldb.version", package.version);

//****** End Performance ******//
