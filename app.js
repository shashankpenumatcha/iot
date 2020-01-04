

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var mqtt = require('mqtt')
var path = require('path');
var io = require('socket.io-client');
var socket = io.connect('http://shashank.local:3001', {reconnection: false,forceNew:true});
var fs = require("fs");
const bcrypt = require('bcrypt');
//const scanner = require('node-wifi-scanner');
//var wifi = require("node-wifi");
 
// Initialize wifi module
// Absolutely necessary even to set interface to null
/* wifi.init({
  iface: wlan0 // network interface, choose a random wifi interface if set to null
});
  */

 var Wifi = require('rpi-wifi-connection');
 var wifi = new Wifi();
require("./wifi.js");

var shell = require('shelljs');
let deviceId;
let hostnameJSON
let hostnameFile = fs.readFileSync('./assets/hostname.json');

if(hostnameFile){
   hostnameJSON = JSON.parse(hostnameFile);
}

if(!hostnameFile || hostnameJSON && !hostnameJSON.id){
  let mac = fs.readFileSync('/sys/class/net/wlan0/address', 'utf8');
  if(mac&&mac.length){
    deviceId=mac.split(':').join('').trim();
    hostnameJSON.id = deviceId;
 }
 fs.writeFileSync('./assets/hostname.json',JSON.stringify(hostnameJSON));
 fs.writeFileSync('/etc/hostname',deviceId);
 shell('reboot')
}else{
  deviceId = hostnameJSON.id;
}
console.log(deviceId);
var device = null; //registered device from server
var boards = []; //registered boards from server
let connections=[];
let state={};
state.boards={};
let localusers  = [];



    

getLocalUsers();
initDevice();


function login(username,password){
  if(username&&password&&localusers.length){
    let user = localusers.filter(f=>f.username==username);
    if(user&&user.password){
      return {"token":user.password}
    }
  }
  return null
}

function getLocalUsers(){
  try{
    let rawdata = fs.readFileSync('./assets/auth.json');
     localusers = JSON.parse(rawdata);
     console.log(localusers)
  }catch(e){
    console.log("error while fetching local user");
    console.log(e);
  }
}

function validateLocalUser(token){  
  user = null;
  if(token&&localusers&&localusers.length){
    user = localusers.fileter(f=>f.password&&f.password==token);
    delete user.password;
  }
  return user;
}





socket.on('connect', function(){

  console.log("connected to web sockets");

  socket.on('deviceInfo',function(deviceEntitiy){
    device = deviceEntitiy;
    if(device&&device.boards&&device.boards.length){
      boards =  device.boards.map(b=>{
        return b.boardId;
      });
    }
  });
  
  socket.on('joined',function(device){
    if(device){
      socket.on('boardDetails',function(msg){
        console.log('getting boards', msg)
        if(Object.keys(state.boards).length){
          console.log('got boards')
          let msg = {deviceId:deviceId,boards:state.boards}
          socket.emit('boards',msg);
        }   
      });
      socket.emit('getDeviceInfo',deviceId);
    }
  });

  socket.emit('join',deviceId);

});



function initDevice(){

  var client  = mqtt.connect('mqtt://raspberrypi.local:1883')
  
  client.on('connect', function () {
    client.subscribe('penumats/handshake/connect',{qos:2,rh:false,rap:false}, function (err) {
      if (!err) {
        console.log('ready to shake hands');
        client.publish('penumats/handshake/reinitiate',"hi")
      }
    });
    client.subscribe("penumats/update");
  });
   
  client.on('message', function (topic, message,packet) {
    if(topic=="penumats/handshake/connect"&&!packet.retain){
      console.log("new nmcu handshake initiated");
      let id = JSON.parse(message.toString()).id;
      if(id && boards.indexOf(id)>=0){
        state.boards[id]=JSON.parse(message.toString());
        console.log("board registered",JSON.stringify(state.boards));
        let msg = {deviceId:deviceId,boards:state.boards}
       //socket.emit("boards",msg);
      }else if(id){
        console.log('rouge board detected ' + id);
      }else{
        console.log('bad handshake, id not found');
      }
    }
    if(topic=="penumats/update"&&!packet.retain){
      console.log("new switch state");
      let id = JSON.parse(message.toString()).id;
      if(id){
        state.boards[id]=JSON.parse(message.toString());
        console.log("boards updated",JSON.stringify(state.boards));
        let msg = {deviceId:deviceId,boards:state.boards}
        socket.emit('boards',msg);
      }
    }
  });

  socket.on('toggle',function(msg){
    if(msg.v==false){
      if(!msg||!msg.b||msg.s==undefined||msg.s==null){
        console.log('bad request')
      }else{
        let board = msg.b;
        let $switch = msg.s;
        if(state.boards[board]&&state.boards[board].switches!=undefined&&state.boards[board].switches[$switch]!=undefined){
          client.publish("penumats/"+board+"/switch/off",JSON.stringify({switch:parseInt($switch),state:false}));
        }else{
          console.log('bad request - board or switch not found')
        }
      }
    }
    if(msg.v==true){
      if(!msg||!msg.b||msg.s==undefined||msg.s==null){
        console.log('bad request')
      }else{
        let board = msg.b;
        let $switch = msg.s;
        if(state.boards[board]&&state.boards[board].switches!=undefined&&state.boards[board].switches[$switch]!=undefined){
          client.publish("penumats/"+board+"/switch/on",JSON.stringify({switch:parseInt($switch),state:true}));
        }else{
          console.log('bad request - board or switch not found')
        }
      }
    }
  })
  
  
  app.get('/boards',function(req,res){
   if(!state||!state.boards){
     return res.status(404).send({error:"boards not found"});
   }
   let boards={};
   Object.keys(state.boards).map(function(m){
      boards[m] = {};
      boards[m].switches=[];
      if(state.boards[m].switches.length){
        state.boards[m].switches.map(function(n,index){
            let ob={};
            ob.label=null;
            ob.on="/on?b="+m+"&s="+index;
            ob.off="/off?b="+m+"&s="+index;
            ob.state = n;
            boards[m].switches.push(ob);
            return n;
        });
      }
      return m;
   });
   return res.status(200).send(boards);
  })


  app.get('/wifi/scan',function(req,res){
    
    wifi.getNetworks().then((networks) => {
      if(networks&&networks.length){
        return res.status(200).send({"networks":networks.filter(f=>f.ssid!='Infrastructure').map(m=>m.ssid)})

      }
      return res.status(200).send({"networks":[]});
    },err=>{
      res.status(500).send({'error':[]})
    });
  
  })

  app.get('/wifi/status',function(req,res){
    
    wifi.getState().then((connected) => {
        if(connected){
          wifi.getNetworks().then((networks) => {
            if(networks&&networks.length){
              return res.status(200).send({"network":networks.filter(f=>f.ssid!='Infrastructure').map(m=>m.ssid)})
      
            }
            return res.status(500).send('error while getting wifi network info');
          },err=>{
            return res.status(500).send({"error":err});

          });
        }else{
          return res.status(200).send({"network":[]});
        }
    },err=>{
      return res.status(500).send({"error":err});

    });
  
  })

  
  app.post('/wifi/join',function(req,res){
    //check for without passowrd
    if(!req.body||!req.body.ssid){
      res.sendStatus(400);
    }
    var conn_info ={
      wifi_ssid:req.body.ssid,
      wifi_passcode:req.body.password?req.body.password:null
    }
    
    // TODO: If wifi did not come up correctly, it should fail
    // currently we ignore ifup failures.
    _enable_wifi_mode(conn_info, function(error) {
      if (error) {
        res.status(500).send('error connecting to wifi')
      }
      res.status(200).send("Wifi Enabled");
      //process.exit(0);
    });
  
  });
  
}

app.use('/mqtt',express.static(path.join(__dirname,'node_modules/mqtt/dist')))
app.use(express.static('public'))
console.log(path.join(__dirname,'node_modeules/mqtt/dist'))

http.listen(3000, function(){
  console.log('listening on *:3000');
});