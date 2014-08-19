/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */


var FuelDB = function (uri, user, password, ssl) {
	'use strict';
	var _uri;
	var _ssl;
	var _wsUri;
	var _httpUri;
	var _user = user;
	var _password = password;
	var _noAuthCmd = ["login"];
	var _noTimeoutCmd = ["subscribe"];
	var _subscribeEvent = {};
	var _events = {};
	var _websocket;
	var _currentUser;
	
	var _init = function () {
		_events[".ERROR"] = function (e) {
			console.log("[Error] " + e.value);
		};
		_events[".WARN"] = function (e) {
			console.log("[Warning] " + e.value);
		};
		_events[".INFO"] = function (e) {
			console.log("[Info] " + e.value);
		};
		_events[".LOGIN_SUCC"] = function (e) {
			_websocket.allowed = true;
			_currentUser = e.value;
			console.log("[Info] Login success as " + _currentUser + " !");
			// Subscribe event initialization
			for (var point in _subscribeEvent) {
				for (var uid in _subscribeEvent[point]) {
					delete _events[point][uid];
					_subscribe(point, _subscribeEvent[point][uid].cb, uid);
				}
			}
			if (_events[".LOGIN_SUCC_2"]) {
				_events[".LOGIN_SUCC_2"](e);
			}
		};
		_events[".LOGIN_FAIL"] = function (e) {
			_websocket.allowed = false;
			console.log("[Error] Login failed !");
			if (_events[".LOGIN_FAIL_2"]) {
				_events[".LOGIN_FAIL_2"](e);
			}
		};
		_events[".REQ_LOGIN"] = function () {
			if (_currentUser && _user && _password) {
				_login(_user,_password);
			} else {
				console.log("[Warning] You need to login !");
			}
		};
	};

	var _send = function (obj) {
		if (_websocket.readyState === WebSocket.OPEN && (_websocket.allowed || _noAuthCmd.indexOf(obj.type) !== -1)) {
			_websocket.send(JSON.stringify(obj));
		} else if (_websocket.readyState === WebSocket.CONNECTING && _noTimeoutCmd.indexOf(obj.type) === -1 ||
			(_websocket.readyState === WebSocket.OPEN && _websocket.allowed === undefined)) {
			setTimeout(function () {
				_send(obj);
			}, 200);
		} else if (_websocket.allowed !== undefined && !_websocket.allowed) {
			console.log("[Warning] You need to login !");
		} else if (_noTimeoutCmd.indexOf(obj.type) !== -1) {
			// Subscription case
			console.log("Subs packet throwed away");
		} else {
			console.log("[Warning] Packet throwed away");
			console.log(obj);
		}
	};
	// Exposed function
	this.connect = function (uri, ssl) {
		_uri = uri ? uri : "xxxxxxxx:xxxx";
		_ssl = ssl === undefined ? "yyyy" : ssl;	
		_wsUri = "ws"+(_ssl?"s":"")+"://"+_uri;
		_httpUri = "http"+(_ssl?"s":"")+"://"+_uri;

		_websocket = new WebSocket(_wsUri);
		_websocket.onopen = function () {
			console.log("WebSocket opened successfully");
		};
		_websocket.onmessage = function (evt) {
			var obj = JSON.parse(evt.data);
			var point = (obj.point.indexOf(".") === 0 ? obj.point : (obj.id ? obj.id : obj.point));
			for(var key in _events){
				if(!point.match(key)){continue;}
				if (typeof(_events[key]) == "function") {
					_events[key](obj);
				} else {
					for (var id in _events[key]) {
						_events[key][id](obj);
					}
				}
			}
		};
		_websocket.onerror = function (evt) {
			console.log("Error: " + evt.data);
		};

		_websocket.onclose = function (evt) {
			console.log("WebSocket closed: " + evt.data);
			setTimeout(function () {
				//_init();
				_connect();
			}, 2000);
		};
	};
	var _connect = this.connect;

	this.login = function (user, password, success, fail) {
		_user = user ? user : _user;
		_password = password ? password : _password;
		if (success) {
			_events[".LOGIN_SUCC_2"] = success;
		}
		if (fail) {
			_events[".LOGIN_FAIL_2"] = fail;
		}
		var obj = {
			"user" : user,
			"password" : password,
			"type" : "login"
		};
		_send(obj);
	};
	var _login = this.login;

	this.disconnect = function () {
		if (_websocket.readyState !== WebSocket.CLOSED){
			_websocket.onclose = function () {}; // disable onclose handler first
			_websocket.close();
			console.log("WebSocket closed by client");
		}
	};

	this.subscribe = function (point, callback, id) {
		var listener = function (e) {
			callback(e);
		};
		var obj = {};
		obj.type = "subscribe";
		obj.point = point;
		_send(obj);
		var uuid = (id === undefined ? uid() : id);
		if (_subscribeEvent[point] === undefined) {
			_subscribeEvent[point] = {};
		}
		if (_events[point] === undefined) {
			_events[point] = {};
		}
		_events[point][uuid] = listener;
		_subscribeEvent[point][uuid] = {
			listener : listener,
			cb : callback
		};
		return uuid;
	};
	var _subscribe = this.subscribe;

	this.unsubscribe = function (point, id) {
		if (id === undefined) {
			delete _events[point];
			delete _subscribeEvent[point];
		} else {
			delete _events[point][id];
			delete _subscribeEvent[point][id];
		}
		var obj = {};
		obj.type = "unsubscribe";
		obj.point = point;
		_send(obj);
	};

	this.write = function (point, value) {
		
		var obj = {};
		obj.type = "set";
		obj.point = point;
		obj.value = value;
		_send(obj);
		
		/*
		var r = new XMLHttpRequest(); 
		r.open("PUT", _httpUri+_computeURL(point), true);
		r.onreadystatechange = function () {
			if (r.readyState != 4 || r.status != 200) return; 
			console.log(r.responseText);
		};
		r.send("value="+value);
		*/
		
	};

	this.remove = function (point) {
		var obj = {};
		obj.type = "remove";
		obj.point = point;
		_send(obj);
	};

	this.read = function (point, callback) {
	
		var id = uid();
		var listener = function (e) {
			delete _events[id];
			callback(e);
		};
		_events[id] = listener;
		var obj = {};
		obj.type = "read";
		obj.point = point;
		obj.id = id;
		_send(obj);
		/*
		var r = new XMLHttpRequest(); 
		r.open("GET", _httpUri+_computeURL(point), true);
		r.onreadystatechange = function () {
			if (r.readyState != 4 || r.status != 200) return; 
			callback(JSON.parse(r.responseText));
		};
		//r.send("");
		*/
	};

	this.browse = function (point, callback) {
		var id = uid();
		var listener = function (e) {
			delete _events[id];
			callback(e.value);
		};
		_events[id] = listener;
		var obj = {};
		obj.type = "browse";
		obj.point = point;
		obj.id = id;
		_send(obj);
	};

	this.getCurrentUser = function () {
		return _currentUser;
	};

	var _computeURL = function(point){
		var toSign = "/"+point.split(".").join("/")+"?timestamp="+new Date().getTime()+"&user="+_user;
		var key = CryptoJS.HmacSHA256(_password,_user)+"";
		var sign = CryptoJS.HmacSHA256(toSign,key);
		return toSign+"&signature="+sign;
	};
	
	var _id = 0;
	var uid = function () {
		return (_id++) + '';
	};

	_init();
	_connect(uri,ssl);
};