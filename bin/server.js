#!/usr/bin/env node

/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */

/** 
 *  Initial import
 */
var path = require("path");
process.chdir(path.dirname(require.main.filename)+'/..');
var manager = require('./manager.js');
var uid = require('./uid.js');
var config = require('../conf/config.json');
var package = require('../package.json');
var auth = require('./auth.js');
var db = require('./memdb.js');
var bodyParser = require('body-parser')
var WebSocket = require('ws');
var net = require('net');
var tls = require('tls')
var os = require("os");
var WebSocketServer = WebSocket.Server;
var fs = require('fs');
var urlParse = require('url');
var qs = require('querystring');
var http = require('http');
var https = require('https');
var cors = require('cors');
var express = require('express');

var functions = {};
var serverType = {};

var cpus = os.cpus();

var clustFct = ["set","remove"];

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
HTTP_METHOD.GET_ARCHIVE = "readArchive";

const app = express();
var expressWs = require('express-ws')(app);

app.use(cors());
app.use('/static', express.static('static'))

app.use(bodyParser.json());
app.use('/rest',function(request,response,next){
	console.log(request.url);
	var url = urlParse.parse(request.url,true);
    try{
        auth.verifyHTTP(url,request.method);
    }catch(e){
        response.writeHead(403, {"Content-Type": "application/json"});
		response.json({"error": e});
		response.end();
		return;
	}
	next();
});

app.use('/rest',function(request, response) {
    if(request.method === "GET" && url.query.type === "browse"){
        request.method = "GET_BROWSE";
    }else if (request.method === "GET" && url.query.type === "archive"){
    	request.method = "GET_ARCHIVE";
    }
	var path = url.pathname.split("/");
	path = path.slice(1,path.length).join(".");
	var obj = {point:path};
    obj.user = url.query.user;
	obj.date = url.query.date;
	obj.value = req.body.value;
	response.onPushed = function(obj){
		response.writeHead(200,{});
		if(obj){
			response.write(JSON.stringify(obj));
		}
		response.end();
	}
	functions[HTTP_METHOD[request.method]](obj,response);
	
	// var body = "";
	// request.on('data', function (data) {
    //     body += data;
    //     if (body.length > 1e6) {
	// 		response.writeHead(413,{'Content-Type' : 'text/plain'}).end();
	// 		request.connection.destroy();
	// 	}
    // });
    // request.on('end', function () {
	// 	body = qs.parse(body);
	// 	response.writeHead(200,{});
	// 	obj.value = body.value;
	// 	// if(wscBroker && clustFct.indexOf(HTTP_METHOD[request.method]) !== -1){
	// 	// 	wscBroker.dispatch(JSON.stringify(obj));
	// 	// }
	// 	response.onPushed = function(obj){
	// 		if(obj){
	// 			response.write(JSON.stringify(obj));
	// 		}
	// 		response.end();
	// 	}
	// 	functions[HTTP_METHOD[request.method]](obj,response);
	// });
});

app.ws("/ws",function(ws, req, next) {
	var url = urlParse.parse(req.url,true);
    try{
        auth.verifyWSURL(url)
    }catch(e){
		ws.close(4403,e+"");
		return;    
	}
	next();
});

app.ws("/ws",function(ws, req) {
	var url = urlParse.parse(req.url,true);
	console.log(req.headers);
	ws.id = uid.gen();
    ws.user = url.query.user;
	console.log("Connection open: "+ws.id);
	_updateConnection(true);
	ws.onPushed = function(msg) {
		if(ws.readyState === WS_STATE.CONNECTING){
			setTimeout(function() {
				ws.onPushed(msg);
			}, 200);
		} else if(ws.readyState === WS_STATE.OPEN) {
            _updateIOPS();
			ws.send(JSON.stringify(msg));
		}
	};
	ws.on('message', function(message) {
        _updateIOPS();
		var obj = JSON.parse(message);
        obj.user = ws.user;
		obj.point = obj.point ? obj.point.trim() : "";
		if (auth.verifyWS(obj)) {
			ws.onPushed(obj);
			return;
		}
		
		if (obj.type in functions && typeof functions[obj.type] === "function") {
			// if(wscBroker && clustFct.indexOf(obj.type) !== -1){
			// 	wscBroker.dispatch(message);
			// }
			functions[obj.type](obj, ws);
		}
	});
	ws.on('error', function(message) {
		console.log("Error: "+message);
	});
	ws.on('close', function(code, message) {
		console.log("Connection lost: "+ws.id);
		_updateConnection(false);
		manager.removeAll(ws.id);
	});
});

var _socketRequestHandle = function(socket) {
	socket.id = uid.gen();
	console.log("Connection open: "+socket.id);
	_updateConnection(true);
	socket.onPushed = function(msg) {
        _updateIOPS();
        socket.write(JSON.stringify(msg)+'\3'); //End Of Text (EOT)
    };
	socket.on('data', function(message) {
		var messages = message.toString('utf8');
		messages.split('\3').forEach(function(msg){
			if(msg == null || msg == ""){
				return;
			}
			_updateIOPS();
        	var obj;
        	try{
        	    obj = JSON.parse(msg);
        	}catch(ex){
        	    obj = {point:".ERROR",value:"Message format is not correct"};
        	    socket.onPushed(obj);
        	    return;
        	}
			obj.point = obj.point ? obj.point.trim() : "";
			if (auth.verifyWS(obj)) {
				socket.onPushed(obj);
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
	socket.on('error', function(message) {
		console.log("Error: "+message);
	});
	socket.on('close', function(code, message) {
		console.log("Connection lost: "+socket.id);
		_updateConnection(false);
		manager.removeAll(socket.id);
	});
};

var _updatePoint = function(point, value){
	var obj = {};
	obj.type = "set";
	obj.point = point;
	obj.value = value;
    obj.user = "system";
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
	db.write(obj.point, obj.value, obj.user, now);
	if(ws){
		ws.onPushed(obj);
		obj.wsId = ws.id;
	}
    delete obj.id;
	delete obj.type;
	obj.date = now.toISOString();
	manager.update(obj.point, obj);
};

functions.read = function read(obj, ws) {
    delete obj.user;
	var tmp = db.read(obj.point);
	obj.value = tmp.value;
	obj.date = tmp.date;
    obj.user = tmp.user;
	if(ws){
		ws.onPushed(obj);
	}else{
		return obj;
	}
};

functions.readArchive = function readArchive(obj, ws) {
    delete obj.user;
    db.readArchive(obj.point,new Date(obj.date),function(value, user, date){
    	obj.value = value;
    	obj.user = user;
    	obj.date = date;
    	if(ws){
    		ws.onPushed(obj);
    	}
    })
};

functions.browse = function browse(obj, ws) {
	delete obj.user;
	obj.value = db.browse(obj.point);
	if(ws){
		ws.onPushed(obj);
	}else{
		return obj;
	}
};

functions.remove = function remove(obj, ws) {
	db.remove(obj.point);
	manager.removeCascade(obj.point);
};

serverType.ws = function(host){
	/*
    var webServer;
	if (host.ssl) {
		var options = {
			key : fs.readFileSync(host.key),
			cert : fs.readFileSync(host.cert)
		};
		webServer = https.createServer(options,app);
	}else{
		webServer = http.createServer(app);
	}
	var wsServer = new WebSocketServer({
		server : webServer
	});
	wsServer.on('connection', _wsRequestHandle);
	webServer.listen(host.port, host.host);
	*/
	app.listen(host.port);
	console.log('Listening for HTTP'+(host.ssl?'S':'')+'/WS'
        +(host.ssl?'S':'')+' at IP ' + host.host + ' on port ' + host.port);
};

serverType.socket = function(host){
    
    var server;
    if (host.ssl) {
		var options = {
			key : fs.readFileSync(host.key),
			cert : fs.readFileSync(host.cert)
		};
		server = tls.createServer(options,_socketRequestHandle);
	}else{
		server = net.createServer(_socketRequestHandle);
	}
    server.on('error', function (e) {
      if (e.code === 'EADDRINUSE') {
        console.log('Address in use, retrying...');
        setTimeout(function () {
          server.close();
          server.listen(host.port, host.host);
        }, 1000);
      }
    });
    server.listen(host.port, host.host, function() { //'listening' listener
        console.log('Listening to socket'+(host.ssl?' over SSL':'')
        +' at IP ' + host.host + ' on port ' + host.port);
    });
};

config.hosts.forEach(function(host){
    if (host.type in serverType && typeof serverType[host.type] === "function") {
        serverType[host.type](host);
    }
});

//****** Performance ******//

//****** CPU Load ******//
setInterval(function(){
	var avg = os.loadavg();
	var avgCpu = {
			"1":(avg[0]/cpus.length)*100,
			"5":(avg[1]/cpus.length)*100,
			"15":(avg[2]/cpus.length)*100
	};
	_updatePoint("fueldb.cpu.load",avgCpu);
},5000);

//****** Current Connections ******//
var _updateConnection = function(inc){
	var count = db.read("fueldb.connection").value;
	if(!count){
		count = 0;
	}
	count += (inc ? 1 : -1);
	_updatePoint("fueldb.connection",count);
};

//****** IOPS ******//
var iops = 0;
var _updateIOPS = function(){
    iops++;
};
setInterval(function(){
	_updatePoint("fueldb.iops",iops+"");
    iops = 0;
},1000);

//****** Version ******//
_updatePoint("fueldb.version",package.version);

//****** End Performance ******//
