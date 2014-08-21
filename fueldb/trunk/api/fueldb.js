/**
 * fueldb: a realtime database
 * Copyright(c) 2014 Joris Basiglio <joris.basiglio@wonderfuel.io>
 * MIT Licensed
 */


var FuelDB = function (target) {
	'use strict';
	var _uri;
	var _ssl;
	var _wsUri;
	var _httpUri;
	var _user;
	var _password;
	var _noTimeoutCmd = ["subscribe"];
	var _subscribeEvent = {};
	var _events = {};
	var _websocket;
	var _currentUser;
	var _onConnect;
	var _onDisconnect;
	var _callPattern = new RegExp("^\\w+(\\.\\w+)*$");
	var _subPattern = new RegExp("^\\w+(\\.(\\w|\\*)+)*$");
	
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
	};

	var _send = function (obj) {
		if (_websocket.readyState === WebSocket.OPEN) {
			_websocket.send(JSON.stringify(obj));
		} else if (_websocket.readyState === WebSocket.CONNECTING && _noTimeoutCmd.indexOf(obj.type) === -1) {
			setTimeout(function () {
				_send(obj);
			}, 200);
		} else {
			console.log("[Warning] Packet throwed away");
			console.log(obj);
		}
	};
	// Exposed function
	this.connect = function (target) {
		_uri = (target && target.uri) ? target.uri : "xxxxxxxx:xxxx";
		_ssl = (target && target.ssl !== undefined) ? target.ssl : "yyyy";
		_user = (target && target.user) ? target.user : _user;
		_password = (target && target.password) ? target.password : _password;
		_wsUri = "ws"+(_ssl?"s":"")+"://"+_uri;
		_httpUri = "http"+(_ssl?"s":"")+"://"+_uri;
		_onConnect = (target && target.onConnected) ? target.onConnected : _onConnect;
		_onDisconnect = (target && target.onDisconnected) ? target.onDisconnected : _onDisconnect;

		_websocket = new WebSocket(_wsUri+_computeURL());
		_websocket.onopen = function () {
			console.log("WebSocket opened successfully");
			if (_onConnect && typeof(_onConnect) == "function") {
				_onConnect();
			}
			// Subscribe event initialization
			for (var point in _subscribeEvent) {
				for (var uid in _subscribeEvent[point]) {
					delete _events[point][uid];
					_subscribe(point, _subscribeEvent[point][uid].cb, uid);
				}
			}
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
			console.log("Error: " + evt.type);
		};
		_websocket.onclose = function (evt) {
			console.log("WebSocket closed, code: " + evt.code+" reason: "+evt.reason);
			if (_onDisconnect && typeof(_onDisconnect) == "function") {
				_onDisconnect();
			}
			if(evt.code < 4000){
				setTimeout(function () {
					_connect();
				}, 2000);
			}
		};
	};
	var _connect = this.connect;

	this.disconnect = function () {
		if (_websocket.readyState !== WebSocket.CLOSED){
			_websocket.onclose = function () {}; // disable onclose handler first
			_websocket.close();
			console.log("WebSocket closed by client");
			if (_onDisconnect && typeof(_onDisconnect) == "function") {
				_onDisconnect();
			}
		}
	};

	this.subscribe = function (point, callback, error) {
		if(!_subPattern.test(point)){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
		var listener = function (e) {
			callback(e);
		};
		var uuid = uid();
		if (_subscribeEvent[point] === undefined) {
			_subscribeEvent[point] = {};
			var obj = {};
			obj.type = "subscribe";
			obj.point = point;
			_send(obj);
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

	this.unsubscribe = function (point, id, error) {
		if(!_subPattern.test(point)){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
		if (id === undefined) {
			delete _events[point];
			delete _subscribeEvent[point];
		} else {
			delete _events[point][id];
			delete _subscribeEvent[point][id];
		}
		if(!(_subscribeEvent[point] && Object.keys(_subscribeEvent[point]).length > 0)){
			if(_subscribeEvent[point]){
				delete _subscribeEvent[point];
			}
			var obj = {};
			obj.type = "unsubscribe";
			obj.point = point;
			_send(obj);
		}
	};

	this.write = function (point, value, error) {
		if(!_callPattern.test(point)){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
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

	this.remove = function (point, error) {
		if(!_callPattern.test(point)){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
		var obj = {};
		obj.type = "remove";
		obj.point = point;
		_send(obj);
	};

	this.read = function (point, callback, error) {
		if(!_callPattern.test(point)){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
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

	this.browse = function (point, callback, error) {
		if(!(_callPattern.test(point) || point === "")){
			if(error && typeof(error) == "function"){
				error("Point "+point+" is not conform");
			}else{
				console.log("Point "+point+" is not conform");
			}
			return;
		}
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
	
	this.getURI = function(){
		return _uri;
	};
	this.getSSL = function(){
		return _ssl;
	};
	
	this.setOnConnected = function(fct){
		_onConnect = fct;
	};
	
	this.setOnDisconnected = function(fct){
		_onDisconnect = fct;
	};

	var _computeURL = function(point){
		var toSign = "/"+(point ? point.split(".").join("/"):"")+"?timestamp="+new Date().getTime()+"&user="+_user;
		var key = CryptoJS.HmacSHA256(_password,_user)+"";
		var sign = CryptoJS.HmacSHA256(toSign,key);
		return toSign+"&signature="+sign;
	};
	
	var _id = 0;
	var uid = function () {
		return (_id++) + '';
	};

	_init();
	_connect(target);
};

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS=CryptoJS||function(h,s){var f={},g=f.lib={},q=function(){},m=g.Base={extend:function(a){q.prototype=this;var c=new q;a&&c.mixIn(a);c.hasOwnProperty("init")||(c.init=function(){c.$super.init.apply(this,arguments)});c.init.prototype=c;c.$super=this;return c},create:function(){var a=this.extend();a.init.apply(a,arguments);return a},init:function(){},mixIn:function(a){for(var c in a)a.hasOwnProperty(c)&&(this[c]=a[c]);a.hasOwnProperty("toString")&&(this.toString=a.toString)},clone:function(){return this.init.prototype.extend(this)}},
r=g.WordArray=m.extend({init:function(a,c){a=this.words=a||[];this.sigBytes=c!=s?c:4*a.length},toString:function(a){return(a||k).stringify(this)},concat:function(a){var c=this.words,d=a.words,b=this.sigBytes;a=a.sigBytes;this.clamp();if(b%4)for(var e=0;e<a;e++)c[b+e>>>2]|=(d[e>>>2]>>>24-8*(e%4)&255)<<24-8*((b+e)%4);else if(65535<d.length)for(e=0;e<a;e+=4)c[b+e>>>2]=d[e>>>2];else c.push.apply(c,d);this.sigBytes+=a;return this},clamp:function(){var a=this.words,c=this.sigBytes;a[c>>>2]&=4294967295<<
32-8*(c%4);a.length=h.ceil(c/4)},clone:function(){var a=m.clone.call(this);a.words=this.words.slice(0);return a},random:function(a){for(var c=[],d=0;d<a;d+=4)c.push(4294967296*h.random()|0);return new r.init(c,a)}}),l=f.enc={},k=l.Hex={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++){var e=c[b>>>2]>>>24-8*(b%4)&255;d.push((e>>>4).toString(16));d.push((e&15).toString(16))}return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b+=2)d[b>>>3]|=parseInt(a.substr(b,
2),16)<<24-4*(b%8);return new r.init(d,c/2)}},n=l.Latin1={stringify:function(a){var c=a.words;a=a.sigBytes;for(var d=[],b=0;b<a;b++)d.push(String.fromCharCode(c[b>>>2]>>>24-8*(b%4)&255));return d.join("")},parse:function(a){for(var c=a.length,d=[],b=0;b<c;b++)d[b>>>2]|=(a.charCodeAt(b)&255)<<24-8*(b%4);return new r.init(d,c)}},j=l.Utf8={stringify:function(a){try{return decodeURIComponent(escape(n.stringify(a)))}catch(c){throw Error("Malformed UTF-8 data");}},parse:function(a){return n.parse(unescape(encodeURIComponent(a)))}},
u=g.BufferedBlockAlgorithm=m.extend({reset:function(){this._data=new r.init;this._nDataBytes=0},_append:function(a){"string"==typeof a&&(a=j.parse(a));this._data.concat(a);this._nDataBytes+=a.sigBytes},_process:function(a){var c=this._data,d=c.words,b=c.sigBytes,e=this.blockSize,f=b/(4*e),f=a?h.ceil(f):h.max((f|0)-this._minBufferSize,0);a=f*e;b=h.min(4*a,b);if(a){for(var g=0;g<a;g+=e)this._doProcessBlock(d,g);g=d.splice(0,a);c.sigBytes-=b}return new r.init(g,b)},clone:function(){var a=m.clone.call(this);
a._data=this._data.clone();return a},_minBufferSize:0});g.Hasher=u.extend({cfg:m.extend(),init:function(a){this.cfg=this.cfg.extend(a);this.reset()},reset:function(){u.reset.call(this);this._doReset()},update:function(a){this._append(a);this._process();return this},finalize:function(a){a&&this._append(a);return this._doFinalize()},blockSize:16,_createHelper:function(a){return function(c,d){return(new a.init(d)).finalize(c)}},_createHmacHelper:function(a){return function(c,d){return(new t.HMAC.init(a,
d)).finalize(c)}}});var t=f.algo={};return f}(Math);
(function(h){for(var s=CryptoJS,f=s.lib,g=f.WordArray,q=f.Hasher,f=s.algo,m=[],r=[],l=function(a){return 4294967296*(a-(a|0))|0},k=2,n=0;64>n;){var j;a:{j=k;for(var u=h.sqrt(j),t=2;t<=u;t++)if(!(j%t)){j=!1;break a}j=!0}j&&(8>n&&(m[n]=l(h.pow(k,0.5))),r[n]=l(h.pow(k,1/3)),n++);k++}var a=[],f=f.SHA256=q.extend({_doReset:function(){this._hash=new g.init(m.slice(0))},_doProcessBlock:function(c,d){for(var b=this._hash.words,e=b[0],f=b[1],g=b[2],j=b[3],h=b[4],m=b[5],n=b[6],q=b[7],p=0;64>p;p++){if(16>p)a[p]=
c[d+p]|0;else{var k=a[p-15],l=a[p-2];a[p]=((k<<25|k>>>7)^(k<<14|k>>>18)^k>>>3)+a[p-7]+((l<<15|l>>>17)^(l<<13|l>>>19)^l>>>10)+a[p-16]}k=q+((h<<26|h>>>6)^(h<<21|h>>>11)^(h<<7|h>>>25))+(h&m^~h&n)+r[p]+a[p];l=((e<<30|e>>>2)^(e<<19|e>>>13)^(e<<10|e>>>22))+(e&f^e&g^f&g);q=n;n=m;m=h;h=j+k|0;j=g;g=f;f=e;e=k+l|0}b[0]=b[0]+e|0;b[1]=b[1]+f|0;b[2]=b[2]+g|0;b[3]=b[3]+j|0;b[4]=b[4]+h|0;b[5]=b[5]+m|0;b[6]=b[6]+n|0;b[7]=b[7]+q|0},_doFinalize:function(){var a=this._data,d=a.words,b=8*this._nDataBytes,e=8*a.sigBytes;
d[e>>>5]|=128<<24-e%32;d[(e+64>>>9<<4)+14]=h.floor(b/4294967296);d[(e+64>>>9<<4)+15]=b;a.sigBytes=4*d.length;this._process();return this._hash},clone:function(){var a=q.clone.call(this);a._hash=this._hash.clone();return a}});s.SHA256=q._createHelper(f);s.HmacSHA256=q._createHmacHelper(f)})(Math);
(function(){var h=CryptoJS,s=h.enc.Utf8;h.algo.HMAC=h.lib.Base.extend({init:function(f,g){f=this._hasher=new f.init;"string"==typeof g&&(g=s.parse(g));var h=f.blockSize,m=4*h;g.sigBytes>m&&(g=f.finalize(g));g.clamp();for(var r=this._oKey=g.clone(),l=this._iKey=g.clone(),k=r.words,n=l.words,j=0;j<h;j++)k[j]^=1549556828,n[j]^=909522486;r.sigBytes=l.sigBytes=m;this.reset()},reset:function(){var f=this._hasher;f.reset();f.update(this._iKey)},update:function(f){this._hasher.update(f);return this},finalize:function(f){var g=
this._hasher;f=g.finalize(f);g.reset();return g.finalize(this._oKey.clone().concat(f))}})})();