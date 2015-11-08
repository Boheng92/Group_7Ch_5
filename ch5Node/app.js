var SerialPort = require("serialport");
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var express = require('express');
var xbee_api = require('xbee-api');
var C = xbee_api.constants;
var sampleDelay = 3000;
var portName = process.argv[2];
var sp;
var update = [0, 1, 0, 0];
var rssi = new Array([4]);
var path = require('path');


io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
  }); 
  
  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
    sp.write(msg + "\n");
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

var routes = require('./routes/index');
app.use('/', routes);
app.use(express.static(path.join(__dirname, 'public')));



var XBeeAPI = new xbee_api.XBeeAPI({
  api_mode: 2
});

//Note that with the XBeeAPI parser, the serialport's "data" event will not fire when messages are received!
var portConfig = {
	baudRate: 9600,
  parser: XBeeAPI.rawParser()
};


sp = new SerialPort.SerialPort(portName, portConfig);


//Create a packet to be sent to all other XBEE units on the PAN.
// The value of 'data' is meaningless, for now.
var RSSIRequestPacket = {
  type: C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
  destination64: "000000000000ffff",
  broadcastRadius: 0x01,
  options: 0x00,
  data: "test"
}

var requestRSSI = function(){
  sp.write(XBeeAPI.buildFrame(RSSIRequestPacket));
}

sp.on("open", function () {
  console.log('open');
  requestRSSI();
  setInterval(requestRSSI, sampleDelay);
  
});


/*MongoClient = require('mongodb').MongoClient
				, assert = require('assert');

url = 'mongodb://localhost:27017/dbTest';	*/


XBeeAPI.on("frame_object", function(frame) {
  if (frame.type == 144){
    console.log("Beacon ID: " + frame.data[1] + ", RSSI: " + (frame.data[0]));
	io.emit("rssi message", frame.data[1] + " " + frame.data[0]);
	//distance = Math.pow(10.0,((A + rssi)/(10.0*n)));
  }
});