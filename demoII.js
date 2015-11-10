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

//for MonogoDB
var MongoClient;
var url;
var mongo = require('mongodb');
MongoClient = require('mongodb').MongoClient, assert = require('assert');
url = 'mongodb://localhost:27017/ch5Node';	//注意这里的DB和collection名字改了，DB叫做ch5Node，collection叫做ch5Collection。


io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
  }); 
  
  socket.on('chat message', function(msg){
    io.emit('chat message', msg);
    sp.write(msg + "\n");
  });
  //for mongodb
  socket.on('DB message', function(msg)
	{
	var rssi0 = parseFloat(msg.substring(1,4));
	var rssi1 = parseFloat(msg.substring(5,8));
	var rssi2 = parseFloat(msg.substring(9,12));
	var rssi3 = parseFloat(msg.substring(13,16));
	var x = parseFloat(msg.substring(18,23));
	var y = parseFloat(msg.substring(24,29));
	
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		var message = {RSSI0: rssi0, RSSI1: rssi1, RSSI2: rssi2, RSSI3: rssi3, X : x, Y : y};
		console.log(" io.on Connected correctly to server");
		var collection = db.collection('ch5Collection');
		
		collection.insert(message, function (err, result) 
			{
				if (err) 
				{
					console.log(err);
				} 
				else 
				{
					console.log('Inserted %d documents into the "ch5Collection" collection. The documents inserted with "_id" are:', result.length, result);

				}

			});

	});
});
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
/*Make our db accessible to the router
app.use(funtion(req,res,next){
	req.db = db;
	*/

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

//Variables for find query.
var update = [0, 0, 0, 0];
var rssis = new Array(0, 0, 0, 0);

var res_X = -999.9;
var res_Y = -999.9;

XBeeAPI.on("frame_object", function(frame) {
  if (frame.type == 144){
    console.log("Beacon ID: " + frame.data[1] + ", RSSI: " + (frame.data[0]));
	io.emit("rssi message", frame.data[1] + " " + frame.data[0]);
	//distance = Math.pow(10.0,((A + rssi)/(10.0*n)));
	
	//to do find()的代码写在此处，具体如何写find query可以参照前几次的challenge.
	//代码示例：db.ch5Collection.find({ $and: [{"RSSI0": { $lt: 100, $gt: -100}}, {"X" : {$lt: 100,$gt:-100}}]})
	//很重要一点！cursor最后一个总是为空！！！
	var range = 20;

	var tempID = frame.data[1];
	var tempRSSI = frame.data[0];
	
	var minDist = 65535;


	update[tempID] = 1;
	rssis[tempID] = tempRSSI;

	//var maxRange = tempRSSI + range;; //查询范围，请自行定义。
	//var minRange = tempRSSI - range;
	
	if( ( update[0] == 1 ) && ( update[1] == 1) && ( update[2] == 1) && ( update[3] == 1) ){
		MongoClient.connect(url, function(err, db) {
			assert.equal(null, err);
			var collection = db.collection('ch5Collection');
			var cursor =collection.find({ $and: [{"RSSI0": { $lt: (rssis[0] + range), $gt: (rssis[0] - range)}}, {"RSSI1" : {$lt: (rssis[1] + range), $gt: (rssis[1] - range)}},{"RSSI2": { $lt: (rssis[2] + range), $gt: (rssis[2] - range)}},{"RSSI3": { $lt: (rssis[3] + range), $gt: (rssis[3] - range)}}]});				
			cursor.sort({X: -1});	//按X坐标递减排列			
			//cursor.limit(10);		//限制数量
			cursor.each(function(err, doc) 
			{					
				if (err) 
				{
					console.log(err);
				} 
				if (doc != null) 
				{
					var tempRSSI = new Array();
									
					tempRSSI[0] = doc.RSSI0;
					tempRSSI[1] = doc.RSSI1;
					tempRSSI[2] = doc.RSSI2;
					tempRSSI[3] = doc.RSSI3;
					
					var tempDist = (rssis[0] - tempRSSI[0])*(rssis[0] - tempRSSI[0]) + (rssis[1] - tempRSSI[1])*(rssis[1] - tempRSSI[1]) + (rssis[2] - tempRSSI[2])*(rssis[2] - tempRSSI[2]) + (rssis[3] - tempRSSI[3])*(rssis[3] - tempRSSI[3]);
					
	
					if(tempDist < minDist)
					{
						minDist = tempDist;

						res_X = doc.X;
						res_Y = doc.Y;
					}


					//var tempY = doc.Y;
					//var emitMsg = '[' + tempX + ']' + '[' + tempY + ']';
					//console.log("checkmsg" + emitMsg);						
					//io.emit("Coordinate Message", emitMsg);
				}
				else
				{
					var msg = '[' + res_X + ']' + '[' + res_Y + ']';
					console.log("coordinate msg" + msg);						
					io.emit("Coordinate Message", msg);
				}
			
			});			
		});	
	}
  }
});
