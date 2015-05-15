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

var _requestHandle = function(request, response, ssl) {
	var url = request.url.split("?")[0].split("/");
	if(request.method === "GET" && (url[1] === "api")){
		var pathName = url.join("/");
		if(pathName.indexOf(".js") !== -1){
            response.writeHead(200, {"Content-Type": "text/javascript"});
        }else{
            response.writeHead(200, {"Content-Type": "text/html"});
        }
		fs.readFile('.'+pathName,'utf8',function(err,api){
			try{
				if(err)throw err;
				response.write(api);
			}catch(e){
				response.writeHead(404);
			} finally {
				response.end();
			}
		});
		return;
	}
	if(request.method === "OPTIONS"){
		response.writeHead(200, {"Allow": "HEAD,GET,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Origin" : "*",
			"Access-Control-Allow-Methods" : "GET,PUT,POST,DELETE",
			"Access-Control-Allow-Headers" : "Content-Type"});
		response.end();
		return;
	}
	url = urlParse.parse(request.url,true);
    try{
        auth.verifyHTTP(url,request.method);
    }catch(e){
        response.writeHead(403, {"Content-Type": "application/json"});
		response.write(JSON.stringify({"error": e}));
		response.end();
		return;
    }
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
	var body = "";
	request.on('data', function (data) {
        body += data;
        if (body.length > 1e6) {
			response.writeHead(413,{'Content-Type' : 'text/plain'}).end();
			request.connection.destroy();
		}
    });
    request.on('end', function () {
		body = qs.parse(body);
		response.writeHead(200, {"Content-Type": "application/json",
			"Access-Control-Allow-Origin" : "*",
			"Access-Control-Allow-Methods" : "GET,PUT,POST,DELETE",
			"Access-Control-Allow-Headers" : "Content-Type"});
		obj.value = body.value;
		if(wscBroker && clustFct.indexOf(HTTP_METHOD[request.method]) !== -1){
			wscBroker.dispatch(JSON.stringify(obj));
		}
		response.onPushed = function(obj){
			if(obj){
				response.write(JSON.stringify(obj));
			}
			response.end();
		}
		functions[HTTP_METHOD[request.method]](obj,response);
	});
};

var _httpsRequestHandle = function(request, response) {
	_requestHandle(request, response, "true");
};

var _httpRequestHandle = function(request, response) {
	_requestHandle(request, response, "false");
};

var _wsRequestHandle = function(ws) {
	var url = urlParse.parse(ws.upgradeReq.url,true);
    try{
        auth.verifyWSURL(url)
    }catch(e){
        setTimeout(function(){
			ws.close(4403,e+"");
		},200);
		return;    
    }
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
			if(wscBroker && clustFct.indexOf(obj.type) !== -1){
				wscBroker.dispatch(message);
			}
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
};

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
				if(wscBroker && clustFct.indexOf(obj.type) !== -1){
					wscBroker.dispatch(message);
				}
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
    if(ws){
		ws.onPushed(obj);
		obj.wsId = ws.id;
	}
    delete obj.id;
	delete obj.type;
	obj.old = db.read(obj.point);
	db.write(obj.point, obj.value, obj.user);
	obj.date = new Date().toISOString();
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
    var httpServer;
	if (host.ssl) {
		var options = {
			key : fs.readFileSync(host.key),
			cert : fs.readFileSync(host.cert)
		};
		httpServer = https.createServer(options,_httpsRequestHandle);
	}else{
		httpServer = http.createServer(_httpRequestHandle);
	}
	var wsServer = new WebSocketServer({
		server : httpServer
	});
	wsServer.on('connection', _wsRequestHandle);
	httpServer.listen(host.port, host.host);
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

//****** Clustering ******//

var wscBroker;
var _connectBroker = function(){
	wscBroker = new WebSocket('ws://'+config.broker.host+':'+config.broker.port
        +auth.computeBrokerURL());
	wscBroker.on('open', function() {
		console.log("connected to broker");
	});
	wscBroker.on('message', function(data, flags) {
		console.log("From broker: "+data);
		var obj = JSON.parse(data);
		if(obj.error){
			console.log(obj.error);
			return;
		}
		obj.point = obj.point ? obj.point.trim() : "";
		if (obj.type in functions && typeof functions[obj.type] === "function") {
			functions[obj.type](obj);
		}
	});
	wscBroker.on('close', function(evt){
		console.log("connection to broker aborted: "+evt);
	});
	wscBroker.dispatch = function(msg){
		wscBroker.send(msg);
	};
};

if(config.broker.enable){
	_connectBroker();
}
var wscBalancer;
var _connectBalancer = function(){
	wscBalancer = new WebSocket('ws://' + config.balancer.host + ':' 
        + config.balancer.port + auth.computeBalancerURL());
	wscBalancer.on('open', function() {
		console.log("connected to balancer");
	});
	wscBalancer.on('message', function(data, flags) {
		console.log("From balancer: " + data);
	});
	wscBalancer.on('close', function(evt) {
		console.log("connection to balancer aborted: " + evt);
	});
};
if(config.balancer.enable){
	_connectBalancer();
}
//****** End Clustering ******//

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
