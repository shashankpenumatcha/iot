
var path = require('path');
var shell = require('shelljs');
var piWifi = require('pi-wifi');
var schedule = require('node-schedule');

var bodyParser = require('body-parser');
var Wifi = require('rpi-wifi-connection');

var express = require('express');
var app = express();

var http = require('http').createServer(app);
var mqtt = require('mqtt')
let deviceId = require('./hostname-setup.js')();
var io = require('socket.io-client');
var config = require('./config.js');
var socket = io.connect(`${config.server}?device=${deviceId}`, {reconnection: true,forceNew:false});

var wifiUtil = require('./wifi.js');
var repo = require("./repo.js");
var registrationService = require('./services/registration.service');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var currentBoard={};
var device = null; //registered device from server
var boards = []; //registered boards from server
let state={};
state.boards={};
let localusers  = require('./local-users.js')();
var wifi = new Wifi();
var init = false;
var client;
var activeSchedules = {};

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
    if(client){
      console.log(client)
    //  client.disconnect();
    }

   // socket.removeAllListeners();
    socket.emit('join',deviceId);
    //initDevice(!init);
  });
    
  socket.on('deviceInfo',function(deviceEntitiy){
    device = deviceEntitiy;
  console.log("got device info")
  console.log(device)
    if(device&&device.boards&&device.boards.length){
      console.log("rtjjjjjjjjjjjjjjjjjjjjjjjj");
      console.log(device)
      boards =  device.boards.map(b=>{
        return b.id;
      });
    }

      initDevice();
    

  });
  //initDevice();
  socket.on('joined',function(device){
    let message_boards = {deviceId:deviceId,boards:state.boards}
    socket.emit("boards",message_boards);
    if(device && !init){
      init = true;
      socket.on('boardDetails',function(msg){
        console.log('getting boards', msg)
        //if(Object.keys(state.boards).length){
          console.log('got boards')
          let board_message = {deviceId:deviceId,boards:state.boards}
          socket.emit('boards',board_message);
       // }   
      });
      socket.emit('getDeviceInfo',deviceId);
    }
  });


  socket.on('addLocation',function(location){
    console.log('add location request')
    if(!location.name){
      console.log('error')
    }
    let switchesArray = [];

    if(location.boards){
      let boards = Object.keys(location.boards);
      if(boards && boards.length){
           boards.map(m => {
            if(location.boards[m]) {
              switches = Object.keys(location.boards[m]);
            } 
            if(switches && switches.length){
              console.log('switches loop to create promise')
              switches.map(s => {
                let swtch = {i:s , b: m, label: location.boards[m][s].label}
                switchesArray.push(swtch);
                return swtch
              })
            }
            return m           
          });
      }
    }
    repo.locationRepo.create(location.name, location.locationId).then(res=>{
      console.log(`Room  created with id #${res.id}`);
      if(switchesArray.length){
        Promise.all(switchesArray.map((s) => {
          console.log(s)
          
          return repo.switchRepo.create(s.label, s.b, s.i, res.id)
        })).then( r=> {
          socket.emit('locationAdded', {deviceId: deviceId, name: location.name, socketId: location.socketId})
        }, e => {
          console.log(`error - location not created on ${deviceId}`)
          socket.emit('locationAdded', {error: `error while creating room in ${deviceId}`,deviceId: deviceId, name: location.name, socketId: location.socketId, devices: location.devices})

        })
      }
    })
  });

socket.on('deleteLocation',function(locationId){
  if(locationId){
    repo.locationRepo.delete(locationId).then(res=>{
      console.log('deleted location ' + locationId )
    },e=>{
      console.log(e);
    })
  }
});

socket.on('deleteSchedule',function(scheduleId){
  if(scheduleId){
    repo.scheduleRepository.delete(scheduleId).then(res=>{
      console.log('deleted schedule ' + scheduleId )
    },e=>{
    console.log(e);
    })
  }
});
  socket.on('addSchedule',function(schedule){
    console.log('add schedule request')
    if(!schedule.name){
      console.log('error - no name for schedule')
      return socket.emit('scheduleAdded', {error: `error no schedule name in request - device - ${deviceId}`,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

    }
    if(!schedule.schedule){
      console.log('error - no schedule in request')
      return socket.emit('scheduleAdded', {error: `error no schedule in request - device - ${deviceId}`,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

    }
    let switchesArray = [];

    if(schedule.boards){
      let boards = Object.keys(schedule.boards);
      if(boards && boards.length){
           boards.map(m => {
            if(schedule.boards[m]) {
              switches = Object.keys(schedule.boards[m]);
            } 
            if(switches && switches.length){
              console.log('switches loop to create promise while creating schedule')
              switches.map(s => {
                console.log('asasasa')
                console.log(schedule.boards[m][s])
                switchesArray.push(schedule.boards[m][s].id);
                return s
              })
            }
            return m           
          });
      }
    }
    console.log(schedule)
     repo.scheduleRepository.create(schedule.name, schedule.scheduleId,1,null,null,null,schedule.schedule.days,schedule.schedule.start,schedule.schedule.end).then(res=>{
      console.log(`schedule  created with id #${res.id}`);
      if(switchesArray.length){
        Promise.all(switchesArray.map((s) => {
          console.log(s)
          
          return repo.scheduleRepository.addMapping(s,res.id)
        })).then( r=> {
          socket.emit('schedule', {deviceId: deviceId, name: schedule.name, socketId: schedule.socketId})
        }, e => {
          console.log(`error - schedule not created on ${deviceId}`)
          socket.emit('scheduleAdded', {error: `error while creating schedule in ${deviceId}`,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})
          setSchedules();
        })
      }
    }) 
  });

  socket.on('getAssignedSwitches', function(socketId) {
    repo.switchRepo.getAll().then(assignedSwitches => {
      console.log(`assigned switchs - ${assignedSwitches}`);
      socket.emit('assignedSwitches', {socketId: socketId, deviceId: deviceId, switches: assignedSwitches})
    }, err => {
      socket.emit('assignedSwitches', {socketId: socketId, deviceId:deviceId ,error : `error whlile getting switches for ${deviceId}`});

    });
  });

  socket.on('getLocations', msg => {
    if(msg.socketId){
      let payload = {};
      payload.socketId = msg.socketId;
      payload.deviceId = deviceId;
      repo.switchRepo.getLocations().then(res => {
        payload.switches = res;
        socket.emit('locations',payload);
      }, error => {
        payload.error = 'error getting locations'
        socket.emit('locations', payload)
      })
    }
  })

  socket.on('addBoard',function(payload){
    console.log('add board request')
    if(!payload.boardId || !payload.socketId){
      payload.error = 'no board id to connect to ap'
      socket.emit("board_added", payload);
      delete currentBoard[id];
      return console.log('no board id to connect to ap')
    }
    let id  = payload.boardId;
    currentBoard[id] = payload;
    if(!payload.deviceInfo){
      currentBoard[id].error = 'no deviceinfo'
      socket.emit("board_added", currentBoard[id]);
      delete currentBoard[id];
      return console.log('no deviceinfo')
      
    }
    var conn_info ={
      wifi_ssid:payload.boardId
    }
    let device = payload.deviceInfo;
    if(device&&device.boards&&device.boards.length){
      boards =  device.boards.map(b=>{
        return b.id;
      });
    }

    piWifi.scan(function(err, networks) {
      if (err) {
        currentBoard[id].error = err.message;
        socket.emit("board_added", currentBoard[id]);
        delete currentBoard[id];
        return console.error(err.message);
      }
      if(!networks||!networks.length){
       currentBoard[id].error = "no networks found";
       socket.emit("board_added", currentBoard[id]);
       delete currentBoard[id];
       return console.log('no networks found');

      }
      network = networks.filter(f=>(f.ssid == payload.boardId));
      if(!network.length){
        console.log("error - no board network found")
        currentBoard[id].error = "error - no board network found";
        socket.emit("board_added", currentBoard[id]);
        delete currentBoard[id];
      }else{
        wifiUtil._add_board(conn_info,payload.deviceId, function(err) {
          if (err) {
          console.log(err)
          console.log("error setup")
          currentBoard[id].error = "error while adding board";
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];

          }
          
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];

            console.log('board registered new path')      //process.exit(0);
        });
      }
    });
    
   
  });





function setSchedules(){
  activeSchedules = {};
  repo.scheduleRepository.getAllActive().then(schedules => {
    if(schedules&&schedules.length){
      schedules.map(s => {
        activeSchedules[s.scheduleId]={};
        activeSchedules[s.scheduleId].on = null;
        activeSchedules[s.scheduleId].off = null;
        activeSchedules[s.scheduleId].schedule = s;
         return s
      })
      let scheduleKeys = Object.keys(activeSchedules);
      if(scheduleKeys && scheduleKeys.length){
        scheduleKeys.map(sk=>{
          console.log(activeSchedules)
          console.log(sk)
          console.log(111111111111)
          
        let s = activeSchedules[sk].schedule;
        console.log(s);
        if(s.start){
          var rule = new schedule.RecurrenceRule();
          rule.hour = s.start.split(":")[0];
          rule.minute = s.start.split(":")[1];
          rule.second = s.start.split(":")[2];
          if(s.days){
            rule.dayOfWeek =  s.days.split(',').map(m=>parseInt(m));
  
          } 
          activeSchedules[sk].on  = schedule.scheduleJob(rule, function(){
            console.log('rule on');
            if(state.boards[s.board]&&state.boards[s.board].switches!=undefined&&state.boards[s.board].switches[s.switch]!=undefined){
              client.publish("penumats/"+s.board+"/switch/on",JSON.stringify({switch:s.switch,state:true}));
            }else{
              console.log('bad request - schedule on board or switch not found')
            }
          });
        }

        if(s.end){
          var endRule = new schedule.RecurrenceRule();
          endRule.hour = parseInt(s.end.split(":")[0]);
          endRule.minute = parseInt(s.end.split(":")[1]);
          endRule.second = parseInt(s.end.split(":")[2]);
          if(s.days){
            endRule.dayOfWeek =  s.days.split(',').map(m=>parseInt(m));
  
          }
          activeSchedules[sk].off  = schedule.scheduleJob(endRule, function(){
            console.log('rule off');
            if(state.boards[s.board]&&state.boards[s.board].switches!=undefined&&state.boards[s.board].switches[s.switch]!=undefined){
              client.publish("penumats/"+s.board+"/switch/off",JSON.stringify({switch:s.switch,state:false}));
            }else{
              console.log('bad request - schedule off board or switch not found')
            }
          });
        }
          return sk
        })
      }
      console.log(activeSchedules);
    }
  },err=>{
    console.log(err)
  })
}

function initDevice(reinit){


 client  = mqtt.connect('mqtt://'+deviceId+'.local:1883')
  
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

        if( currentBoard[id]){
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];
        }

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

  if(!reinit||reinit){

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

  setSchedules();

  
}

app.use('/mqtt',express.static(path.join(__dirname,'node_modules/mqtt/dist')))
app.use(express.static('public'))
http.listen(3000, function(){
  console.log('listening on *:3000');
});