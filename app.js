
var path = require('path');

var bodyParser = require('body-parser');
var Wifi = require('rpi-wifi-connection');
var shell = require('shelljs');

var express = require('express');
var app = express();

var http = require('http').createServer(app);
var mqtt = require('mqtt')
let deviceId = require('./hostname-setup.js')();
var io = require('socket.io-client');
var socket = io.connect(`http://shashank.local:3001?device=${deviceId}`, {reconnection: false,forceNew:true});

var wifiUtil = require('./wifi.js');
var repo = require("./repo.js");
var registrationService = require('./services/registration.service');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var device = null; //registered device from server
var boards = []; //registered boards from server
let state={};
state.boards={};
let localusers  = require('./local-users.js')();
var wifi = new Wifi();


function error(error){
  return {"error":error};
}

//auth middleware
function auth(req,res,next){  
  if(!req.header('Authorization')){
    return res.status(401).send(error("no auth header"))
  }
  let token = req.header('Authorization');
  user = null;
  if(localusers&&localusers.length&&token){
      user = localusers.filter(f=>f.password&&f.password==token);    
  }
  if(user&&user.length){
    return next()
  }
  return res.sendStatus(401)
}


socket.on('connect', function(){
  console.log("connected to web sockets");
  socket.on('deviceInfo',function(deviceEntitiy){
    device = deviceEntitiy;
    console.log(device)
    if(device&&device.boards&&device.boards.length){
      boards =  device.boards.map(b=>{
        return b.id;
      });
    }
    initDevice();

  });
  //initDevice();
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

  socket.on('addLocation',function(location){
    console.log('add location request')
    if(!location.name){
      console.log('error')
    }
    if(location.boards){
      let boards = Object.keys(location.boards);
      let swithces = [];
      if(boards && boards.length){
           boards.map(m => {
            if(location.boards[m]) {
              switches = Object.keys(location.boards[m]);
            } 
            if(switches && switches.length){
              console.log('switches loop to create promise')
              switches.map(s => {
                let swtch = {i:s , b: m, label: location.boards[m][s].label}
                switches.push(swtch);
                return swtch
              })
            }
            return m           
          });
      }
    }
    repo.locationRepo.create(location.name).then(res=>{
      console.log(`Room  created with id #${res.id}`);
      if(switches.length){
        Promise.all(switches.map((swtch) => {
          const { label, b, i } = swtch
          console.log(label)
          console.log(b)
          console.log(i)
          return repo.switchRepo.create(label, b, i, res.id)
        })).then( r=> {
          socket.emit('locationAdded', {deviceId: deviceId, name: location.name})
        }, e => {
          console.log('error delete room manually')
        })
      }
    })
  });
});


function initDevice(){

  var client  = mqtt.connect('mqtt://'+deviceId+'.local:1883')
  
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
       socket.emit("boards",msg);
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
  
  app.post('/api/password/reset',auth,function(req,res){
    if(!req.body||!req.body.username||!req.body.password||!req.body.oldPassword){
      return res.status(400).send(error("Bad Request"))
    }
    registrationService.resetPassword(req.body.username,req.body.password,req.body.oldPassword).then(function(reset){
      if(reset.message){
        return res.status(200).send(reset)
      }
    },function(err){
      return res.status(500).send(reset)

    })
  
  })

  app.post('/api/login',function(req,res){
    if(!req.body||!req.body.username||!req.body.password){
      return res.status(400).send({'error':'username and password are required'});
    }
    registrationService.login(req.body.username,req.body.password).then(function(user){
        if(user.error){
          return res.status(400).send({"error":"Bad Credentials"})
        }
        return res.status(200).send(user);
      },function(err){
        return res.sendStatus(401)
      })
  })
  
  app.get('/api/boards',auth,function(req,res){
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


  app.get('/api/wifi/scan',auth,function(req,res){    
    wifi.getNetworks().then((networks) => {
      if(networks&&networks.length){
        return res.status(200).send({"networks":networks.filter(f=>f.ssid!='Infrastructure').map(m=>m.ssid)})

      }
      return res.status(200).send({"networks":[]});
    },err=>{
      res.status(500).send({'error':[]})
    });
  
  })

  app.get('/api/wifi/status',auth,function(req,res){
    
    wifi.getStatus().then((connection) => {
        if(connection){
          return res.status(200).send({"network":connection});
        }else{
          return res.status(200).send({"network":[]});
        }
    },err=>{
      return res.status(500).send({"error":err});

    });
  
  })

  
  app.post('/api/wifi/join',auth,function(req,res){
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
    wifiUtil._enable_wifi_mode(conn_info, function(err) {
      if (err) {
        res.status(500).send('error connecting to wifi')
      }
      res.status(200).send("Wifi Enabled");
      //process.exit(0);
    });
  
  });
  
}

app.use('/mqtt',express.static(path.join(__dirname,'node_modules/mqtt/dist')))
app.use(express.static('public'))
http.listen(3000, function(){
  console.log('listening on *:3000');
});