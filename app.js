
var path = require('path');
var shell = require('shelljs');
var piWifi = require('pi-wifi');
var schedule = require('node-schedule');
var moment = require('moment');
var cors = require('cors');
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
app.use('/mqtt',express.static(path.join(__dirname,'node_modules/mqtt/dist')))
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
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
var stats =  {};
var pendingStats = [];
var persisting = false;
var usageSchedule = false;
let one = '2020-03-30T02:47:00+05:30';
let two = '2020-03-30T23:50:00+05:30';
let three =  '2020-03-31T00:00:10+05:30';
function error(error){
  return {"error":error};
}
async function clearOnStart(){
  try{
    let allonstats = await repo.usageRepository.getAllOn();
    if(allonstats && allonstats.length){
      try{
        clearedAllOn= await repo.usageRepository.clearOn();
      }catch(er){
        console.log("error while clearOn")  
        console.log(er)
      }
    }
  }catch(e){
   console.log("error while getting all on")  
   console.log(e)
  }
}
clearOnStart();
var statsRule = new schedule.RecurrenceRule();
//statsRule.minute = new schedule.Range(0, 59)
statsRule.dayOfWeek = [0, new schedule.Range(1, 6)];
statsRule.hour = 00;
statsRule.minute = 01;
statsRule.second = 0;
var j = schedule.scheduleJob(statsRule, function(){
  let usageScheduleDate =  moment();
  usageScheduleDate.subtract(1, "days");
  usageScheduleDate.set({h:23,m:59})
  let usageScheduleDatenext = moment(usageScheduleDate);
  usageScheduleDatenext.add(1,'days');
  usageScheduleDatenext.set({h:00,m:00})
  let usageScheduleWeek = usageScheduleDate.week();
  console.log(":::::::::::::::::::::::usage schedule rule every night")
  repo.switchRepo.getOnStats(usageScheduleWeek).then(res=>{
    if(res&&res.length){
      console.log(":::::::::::::::::::::::usage schedule rule every night switch count:"+res.length)

      res.map(m=>{
        if(m.lastOnTime){
          usageSchedule = true;
          if(!stats[m.board]){
            stats[m.board] = {};
          }
          persisting = true;
          stats[m.board][m.switch]={};
          handleOnForTracking(m.board,m.switch,m.lastOnTime)
          handleOffForTracking(m.board,m.switch,usageScheduleDate.format())
          handleOnForTracking(m.board,m.switch,usageScheduleDatenext.format())
          persisting=false;
       
        }
        return m;
      })
      persistUsage(true);
    }
    
  },err=>{
    console.log(err)
    console.log("usage schedule error")
  })
});


var usageMailRule = new schedule.RecurrenceRule();
//usageMailRule.minute = new schedule.Range(0, 59)
usageMailRule.dayOfWeek = 0;
usageMailRule.hour = 00;
usageMailRule.minute = 15;
usageMailRule.second = 0;
var ja = schedule.scheduleJob(usageMailRule, function(){
  console.log("mailer schedule")
  mailer();
});

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


socket.on('scan',function(socketId){
  console.log("req to get networs")
 
  wifi.scan().then((networks) => 
  {
    console.log(networks)
    if(networks&&networks.length){
      console.log('networks length')

      socket.emit('networks',{socketId:socketId,networks:networks.filter(f=>f.ssid!='Infrastructure').map(m=>m.ssid)})
    }
  },err=>{
    socket.emit('networks',{socketId:socketId,error:'error while scanning netowrks'})
  });
})


socket.on('update_wifi', function(msg){
  console.log("update wifi request received");
  if(!msg||!msg.name||!msg.password||!msg.socketId){
    console.log('update wifi bad request')
  }
  const socketId = msg.socketId;
  delete msg.socketId;
  console.log('boards')
  console.log(state.boards);
  if(state.boards){
    let _boards = Object.keys(state.boards);
    _boards.map(b=>{
      console.log(b)
      console.log(msg)
      msg.device = deviceId;
      client.publish("penumats/"+b+"/wifi",JSON.stringify(msg));

      return b
    })
  }
  var conn_info ={
    wifi_ssid:msg.name,
    wifi_passcode:msg.password?msg.password:null
  }
  
  // TODO: If wifi did not come up correctly, it should fail
  // currently we ignore ifup failures.
  wifiUtil._enable_wifi_mode(conn_info, function(err) {
    if (err) {
     console.log('error connecting to wifi')
    }
    console.log("Wifi Enabled");
    //process.exit(0);
  });

});

  socket.on('connect', function(){
    console.log("connected to web sockets");
    if(client){
      //console.log(client)
    // client.disconnect();
    }

   // socket.removeAllListeners();
    socket.emit('join',deviceId);
    //initDevice(!init);
  });
    
  socket.on('deviceInfo',function(deviceEntitiy){
    device = deviceEntitiy;
  console.log("got device info")
  //console.log(device)
    if(device&&device.boards&&device.boards.length){
      //console.log("rtjjjjjjjjjjjjjjjjjjjjjjjj");
      //console.log(device)
      boards =  device.boards.map(b=>{
        return b.id;
      });
    }

      initDevice();
    

  });
  socket.on('deviceInfo2',function(deviceEntitiy){
    device = deviceEntitiy;
  console.log("got device info2")
  //console.log(device)
    if(device&&device.boards&&device.boards.length){
      //console.log("rtjjjjjjjjjjjjjjjjjjjjjjjj");
      //console.log(device)
      boards =  device.boards.map(b=>{
        return b.id;
      });
    }

    client.publish('penumats/handshake/reinitiate',"hi")
    
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

  socket.on('editSwitch',function(msg){
    console.log('editSwitch name request')
    if(!msg || !msg.switch || !msg.switch.name || !msg.switch.id){
      console.log('bad request from device')
      return socket.emit('editSwitch',{error:'bad request from editSwitch device',socket:msg.socket});
    }
    repo.switchRepo.updateName(msg.switch).then(res=>{
      console.log(`switch name updated`);
      socket.emit('editedSwitch',{switch:msg.switch, socket:msg.socket});
    },err=>{
      console.log('error while editing switch name')
      console.log(err);
      socket.emit('editedSwitch',{error:'error while editing switch name',socket:msg.socket});

    })
  });

  socket.on('editSwitchLogo',function(msg){
    console.log('editSwitch Logo request')
    if(!msg || !msg.switch || !msg.switch.switchLogo || !msg.switch.id){
      console.log('bad request from device')
      return socket.emit('editSwitch',{error:'bad request from editswitchLogo device',socket:msg.socket});
    }
    repo.switchRepo.updateLogo(msg.switch).then(res=>{
      console.log(`switchLogo updated`);
      socket.emit('editedSwitchLogo',{switch:msg.switch, socket:msg.socket});
    },err=>{
      console.log('error while editing switchLogo')
      console.log(err);
      socket.emit('editedSwitchLogo',{error:'error while editing switchLogo',socket:msg.socket});

    })
  });

  socket.on('editLocationName',function(msg){
    console.log('edit location name request')
    if(!msg || !msg.location || !msg.location.name){
      console.log('bad request from device')
      return socket.emit('editedLocationName',{error:'bad request from device',socket:msg.socket});
    }
    repo.locationRepo.updateName(msg.location).then(res=>{
      console.log(`location name updated`);
      socket.emit('editedLocationName',{name:msg.location.name,socket:msg.socket});
    },err=>{
      console.log('error while editing location name')
      console.log(err);
      socket.emit('editedLocationName',{error:'error while editing location name',socket:msg.socket});

    })
  });

  socket.on('editLocationLogo',function(msg){
    console.log('edit location logo request')
    console.log(msg)
    if(!msg || !msg.location || msg.location.locationLogo == undefined){
      console.log('bad request from device')
      return socket.emit('editedLocationLogo',{error:'bad request from device',socket:msg.socket});
    }
    repo.locationRepo.updateLogo(msg.location).then(res=>{
      console.log(`location Logo updated`);
      socket.emit('editedLocationLogo',{locationLogo:msg.location.locationLogo,socket:msg.socket});
    },err=>{
      console.log('error while editing location Logo')
      console.log(err);
      socket.emit('editedLocationLogo',{error:'error while editing location Logo',socket:msg.socket});

    })
  });

  socket.on('deleteSwitch',function(msg){
    console.log('delete switch request')
    if(!msg || !msg.switch || !msg.switch.id){
      console.log('bad deleteSwitch request from device')
      socket.emit('deletedSwitch',{error:'bad deletedSwitch request from device',socket:msg.socket});
    }
    repo.switchRepo.delete(msg.switch.id).then(res=>{
      console.log(`switch deleted`);
      socket.emit('deletedSwitch',{switch:msg.switch,socket:msg.socket});
    },err=>{
      console.log('error while deletedSwitch')
      console.log(err);
      socket.emit('deletedSwitch',{error:'error while deletedSwitch',socket:msg.socket});

    })
  });


  socket.on('deleteLocation',function(msg){
    console.log('deleteLocation request')
    if(!msg || !msg.locationId){
      console.log('bad deleteLocation request from device')
      socket.emit('deletedLocation',{error:'bad deletedLocation request from device',socket:msg.socket});
    }
    repo.locationRepo.delete(msg.locationId).then(res=>{
      console.log(`location deleted`);
      socket.emit('deletedLocation',{id:msg.locationId,socket:msg.socket});
    },err=>{
      console.log('error while deletedLocation')
      console.log(err);
      socket.emit('deletedLocation',{error:'error while deletedLocation',socket:msg.socket});

    })
  });

  socket.on('addSwitches',function(msg){
    console.log('add switches request')
    if(!msg.locationId){
      console.log('error')
    }
    let switchesArray = [];

    if(msg.boards){
      let boards = Object.keys(msg.boards);
      if(boards && boards.length){
           boards.map(m => {
            if(msg.boards[m]) {
              switches = Object.keys(msg.boards[m]);
            } 
            if(switches && switches.length){
              console.log('switches loop to create promise')
              switches.map(s => {
                let swtch = {i:s , b: m, label: msg.boards[m][s].label, switchLogo: msg.boards[m][s].switchLogo}
                switchesArray.push(swtch);
                return swtch
              })
            }
            return m           
          });
      }
    }
    repo.locationRepo.getById(msg.locationId).then(res=>{
      console.log(`found location with id #${res.id}`);
      if(switchesArray.length){
        Promise.all(switchesArray.map((s) => {
         // console.log(s)
          
          return repo.switchRepo.create(s.label, s.b, s.i, res.id, s.switchLogo)
        })).then( r=> {
          socket.emit('switchesAdded', {deviceId: deviceId, name: msg.name, socketId: msg.socketId, location:msg.location})
        }, e => {
          console.log(`error - switches not added on ${deviceId}`)
          socket.emit('switchesAdded', {error: `error adding switches in ${msg.locationId}`,deviceId: deviceId, name: msg.name, socketId: msg.socketId, devices: msg.devices})

        })
      }
    })
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
                let swtch = {i:s , b: m, label: location.boards[m][s].label,switchLogo:location.boards[m][s].switchLogo}
                switchesArray.push(swtch);
                return swtch
              })
            }
            return m           
          });
      }
    }
    repo.locationRepo.create(location.name, location.locationId,location.locationLogo).then(res=>{
      console.log(`Room  created with id #${res.id}`);
      if(switchesArray.length){
        Promise.all(switchesArray.map((s) => {
         // console.log(s)
          
          return repo.switchRepo.create(s.label, s.b, s.i, res.id,s.switchLogo)
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

socket.on('editSchedule',function(schedule){
  console.log('edit schedule request')
  if(!schedule.name){
    console.log('error - no name for schedule for edit')
    return socket.emit('scheduleEdited', {error: `error no schedule name in request - device - ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

  }
  if(!schedule.schedule){
    console.log('error - no schedule in request for edit')
    return socket.emit('scheduleEdited', {error: `error no schedule in request - device - ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

  }
  if(!schedule.id){
    console.log('error - no schedule id in request for edit')
    return socket.emit('scheduleEdited', {error: `error no schedule in request - device - ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

  }


  console.log('request to edit/delete schedule');
  repo.scheduleRepository.getAllById(schedule.id).then(res => {
    
    console.log('all schedules by id')
    if(res && res.length){
      repo.scheduleRepository.deleteById( schedule.id).then(r => {
        console.log('eit/deleted schedule by id')
        if(r){
            let id;
            res.map(m => {
              id = m.id;
              if(activeSchedules&&activeSchedules[m.id]) {
                if(activeSchedules[m.id][m.sw_id]){
                  if(activeSchedules[m.id][m.sw_id].on){
                    activeSchedules[m.id][m.sw_id].on.cancel();
                  }
                  if(activeSchedules[m.id][m.sw_id].off){
                    activeSchedules[m.id][m.sw_id].off.cancel();
                  }
                }
              }
              return m;
            })
            if(id) {

              activeSchedules[id] = null;
            }
          
            //create schedule
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
                      //  console.log('asasasa')
                        console.log(schedule.boards[m][s])
                        if(schedule.boards[m][s].sw_id!=null&&schedule.boards[m][s].sw_id!=undefined){

                          switchesArray.push(schedule.boards[m][s].sw_id);
                        }else{
                          switchesArray.push(schedule.boards[m][s].id);

                        }
                        return s
                      })
                    }
                    return m           
                  });
              }
            }
            //console.log(schedule)
            repo.scheduleRepository.create( schedule.scheduleId,schedule.name,1,null,null,null,schedule.schedule.days.toString(),schedule.schedule.start,schedule.schedule.end).then(res=>{
              console.log(`schedule  created with id #${res.id}`);
              if(switchesArray.length){
                Promise.all(switchesArray.map((s) => {
                //  console.log(s)
                  
                  return repo.scheduleRepository.addMapping(s,res.id)
                })).then( r=> {
                  socket.emit('scheduleEdited', {scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId})
                  setScheduleById(schedule.scheduleId)
                }, e => {
                  console.log(`error - schedule not created on ${deviceId}`)
                  socket.emit('scheduleEdited', {error: `error while creating/editing schedule in ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})
                })
              }
            }) 
         
        }
      }, err => {
        socket.emit('scheduleToggled', payload);
      })
    }
  }, err => {
    socket.emit('scheduleToggled', payload);
  })


});

/* socket.on('deleteSchedule',function(scheduleId){
  if(scheduleId){
    repo.scheduleRepository.delete(scheduleId).then(res=>{
      console.log('deleted schedule ' + scheduleId )
    },e=>{
    console.log(e);
    })
  }
}); */
  socket.on('addSchedule',function(schedule){
    console.log('add schedule request')
    if(!schedule.name){
      console.log('error - no name for schedule')
      return socket.emit('scheduleAdded', {error: `error no schedule name in request - device - ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

    }
    if(!schedule.schedule){
      console.log('error - no schedule in request')
      return socket.emit('scheduleAdded', {error: `error no schedule in request - device - ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})

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
              //  console.log('asasasa')
              //  console.log(schedule.boards[m][s])
                switchesArray.push(schedule.boards[m][s].id);
                return s
              })
            }
            return m           
          });
      }
    }
    //console.log(schedule)
     repo.scheduleRepository.create( schedule.scheduleId,schedule.name,1,null,null,null,schedule.schedule.days.toString(),schedule.schedule.start,schedule.schedule.end).then(res=>{
      console.log(`schedule  created with id #${res.id}`);
      if(switchesArray.length){
        Promise.all(switchesArray.map((s) => {
        //  console.log(s)
          
          return repo.scheduleRepository.addMapping(s,res.id)
        })).then( r=> {
          socket.emit('scheduleAdded', {scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId})
          setScheduleById(schedule.scheduleId)
        }, e => {
          console.log(`error - schedule not created on ${deviceId}`)
          socket.emit('scheduleAdded', {error: `error while creating schedule in ${deviceId}`,scheduleId:schedule.scheduleId,deviceId: deviceId, name: schedule.name, socketId: schedule.socketId, devices: schedule.devices})
        })
      }
    }) 
  });

  socket.on('getAssignedSwitches', function(socketId) {
    repo.switchRepo.getAll().then(assignedSwitches => {
    //  console.log(`assigned switchs - ${assignedSwitches}`);
      socket.emit('assignedSwitches', {socketId: socketId, deviceId: deviceId, switches: assignedSwitches})
    }, err => {
      socket.emit('assignedSwitches', {socketId: socketId, deviceId:deviceId ,error : `error whlile getting switches for ${deviceId}`});

    });
  });

  socket.on('getSchedules',function(msg){

    let schedules =  repo.scheduleRepository.getAll().then(schedules=>{
      socket.emit('schedules', {socketId:msg.socketId, deviceId:msg.deviceId, schedules:schedules, activeSchedules:activeSchedules})

    },err=>{
      socket.emit('schedules', {socketId: msg.socketId, deviceId:msg.deviceId ,error : `error whlile getting schedules for ${deviceId}`});

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

  
  socket.on('getUsage', msg => {
    if(msg.socketId){
      let payload = {};
      payload.socketId = msg.socketId;
      payload.deviceId = deviceId;
      let week = new moment(new Date()).week()
      repo.switchRepo.getStats(week).then(res => {
        payload.switches = res;
        payload.switches = payload.switches.map(m=>{
          let days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
          let duration = null;
          days.map(d => {
              if(m[d]){
                if(!duration){
                  duration = moment.duration(m[d]);
                }else{
                  duration.add(moment.duration(m[d]))
                }
                m[d] = `${moment.duration(m[d]).hours()} hours, ${moment.duration(m[d]).minutes()} minutes and ${moment.duration(m[d]).seconds()} seconds`
                if(moment.duration(m[d]).days()){
                  m[d] = `${moment.duration(m[d]).days()} days, ${moment.duration(m[d]).hours()} hours, ${moment.duration(m[d]).minutes()} minutes and ${moment.duration(m[d]).seconds()} seconds`
                }
              }
            return d
          })
          if(duration){
            m.duration = `${duration.hours()} hours, ${duration.minutes()} minutes and ${duration.seconds()} seconds`
            if(duration.days()){
              m.duration = `${duration.days()} days, ${duration.hours()} hours, ${duration.minutes()} minutes and ${duration.seconds()} seconds`
            }
          }


          return m;

        })
        socket.emit('usage',payload);
      }, error => {
        payload.error = 'error getting usage'
        socket.emit('usage', payload)
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
        currentBoard[id].error = "error - no board network found";
        socket.emit("board_added", currentBoard[id]);
        delete currentBoard[id];
        return  console.log("error - no board network found")

      }else{
        wifiUtil._add_board(conn_info,payload.deviceId, function(err) {
          if (err) {
          console.log(err)
          currentBoard[id].error = "error while adding board";
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];
          return     console.log("error setup")


          }
         // console.log('rtjjjjjjjjjjjjjjjjjjjjjjjjj')
          
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];

            return console.log('board registered new path')      //process.exit(0);
        });
      }
    });
    
   
  });

  socket.on('deleteSchedule', payload => {
    console.log('request to delete schedule');
    repo.scheduleRepository.getAllById(payload.scheduleId).then(res => {
      
      console.log('all schedules by id')
      if(res && res.length){
        repo.scheduleRepository.deleteById( payload.scheduleId).then(r => {
          console.log('deleted schedule by id')
          if(r){
            socket.emit('scheduleDeleted', payload); 
              let id;
              res.map(m => {
                id = m.id;
                if(activeSchedules&&activeSchedules[m.id]) {
                  if(activeSchedules[m.id][m.sw_id]){
                    if(activeSchedules[m.id][m.sw_id].on){
                      activeSchedules[m.id][m.sw_id].on.cancel();
                    }
                    if(activeSchedules[m.id][m.sw_id].off){
                      activeSchedules[m.id][m.sw_id].off.cancel();
                    }
                  }
                }
                return m;
              })
              if(id) {
  
                activeSchedules[id] = null;
              }
            
           
          }
        }, err => {
          socket.emit('scheduleToggled', payload);
        })
      }
    }, err => {
      socket.emit('scheduleToggled', payload);
    })
   // console.log(activeSchedules)
  })

socket.on('toggleSchedule', payload => {
//  console.log('request to toggle schedule' + payload.active);
  repo.scheduleRepository.getAllById(payload.scheduleId).then(res => {

    console.log('all schedules by id')
    if(res && res.length){
      repo.scheduleRepository.updateActiveById(!payload.active, payload.scheduleId).then(r => {
        console.log('updated active by id')
        if(r){
          socket.emit('scheduleToggled', payload); 
          if(payload.active){
            let id;
            res.map(m => {
              id = m.id;
              if(activeSchedules&&activeSchedules[m.id]) {
                if(activeSchedules[m.id][m.sw_id]){
                  if(activeSchedules[m.id][m.sw_id].on){
                    activeSchedules[m.id][m.sw_id].on.cancel();
                  }
                  if(activeSchedules[m.id][m.sw_id].off){
                    activeSchedules[m.id][m.sw_id].off.cancel();
                  }
                }
              }
              return m;
            })
            if(id) {

              activeSchedules[id] = null;
            }
          }
          if(!payload.active){
              if(res && res.length){
                processSchedules(res);
              //  console.log(activeSchedules);
              }
          }
        }
      }, err => {
        socket.emit('scheduleToggled', payload);
      })
    }
  }, err => {
    socket.emit('scheduleToggled', payload);
  })
 // console.log(activeSchedules)
})

function processSchedules(schedules) {
  console.log("processing schedules");

  if(schedules&&schedules.length){
    schedules.map(s => {
      if(!activeSchedules[s.id]){
        activeSchedules[s.id]={};
      }
        if(!activeSchedules[s.id][s.sw_id]){
          activeSchedules[s.id][s.sw_id]={};
        }
        activeSchedules[s.id][s.sw_id].on = null;
        activeSchedules[s.id][s.sw_id].off = null;
        activeSchedules[s.id][s.sw_id].schedule = s;
      

       return s
    })
    let scheduleKeys = Object.keys(activeSchedules);
    if(scheduleKeys && scheduleKeys.length){
      scheduleKeys.map(sk=>{
        if(activeSchedules[sk]){
          let switchKeys = Object.keys(activeSchedules[sk]);
          if(switchKeys&&switchKeys.length){
            switchKeys.map(swk=>{
            
              let s = activeSchedules[sk][swk].schedule;
             // console.log(s);
              if(!activeSchedules[sk][swk].on){
                  
                if(s.start){
                  var rule = new schedule.RecurrenceRule();
                  rule.hour = s.start.split(":")[0];
                  rule.minute = s.start.split(":")[1];
                  rule.second = s.start.split(":")[2];
                  if(s.days){
                    rule.dayOfWeek =  s.days.split(',').map(m=>parseInt(m));
          
                  } 
                  activeSchedules[sk][swk].on  = schedule.scheduleJob(rule, function(){
                    console.log('rule on');
                    if(state.boards[s.board]&&state.boards[s.board].switches!=undefined&&state.boards[s.board].switches[s.switch]!=undefined){
                      client.publish("penumats/"+s.board+"/switch/on",JSON.stringify({switch:s.switch,state:true}));
                    //  console.error(s)
                      handleOnForTracking(s.board,s.switch,null)
                    }else{
                      console.log('bad request - schedule on board or switch not found')
                    }
                  });
                }
              }
              if(!activeSchedules[sk][swk].off){
                if(s.end){
                  var endRule = new schedule.RecurrenceRule();
                  endRule.hour = parseInt(s.end.split(":")[0]);
                  endRule.minute = parseInt(s.end.split(":")[1]);
                  endRule.second = parseInt(s.end.split(":")[2]);
                  if(s.days){
                    endRule.dayOfWeek =  s.days.split(',').map(m=>parseInt(m));
                  }
                  activeSchedules[sk][swk].off  = schedule.scheduleJob(endRule, function(){
                    console.log('rule off');
                    if(state.boards[s.board]&&state.boards[s.board].switches!=undefined&&state.boards[s.board].switches[s.switch]!=undefined){
                      client.publish("penumats/"+s.board+"/switch/off",JSON.stringify({switch:s.switch,state:false}));
                      handleOffForTracking(s.board,s.switch,null)
                    }else{
                      console.log('bad request - schedule off board or switch not found')
                    }
                  });
                }
              }
              return swk
            })
          }
        }
        return sk
      })
    }
   // console.log(activeSchedules);
  }
}

function initStats(b,s) {
  if(!stats[b]){
    stats[b] = {};
  }
  if(!stats[b][s]){
    stats[b][s] = {};
  }
  if(!stats[b][s].current){
    stats[b][s].current = {
      on:null,
      off:null,
      b:b,
      s:s
    };
  }

}
async function persistUsage(us){
//  console.log(pendingStats)
  persisting = true;
  let days = ['sunday', 'monday','tuesday','wednesday','thursday','friday','saturday']
  if(!pendingStats.length){
    persisting = false
    return
  }
  let current  = pendingStats.shift();
  if(!current||!current.on){
    return persistUsage(us)
  }
  let res =null;
  try{
     res = await repo.usageRepository.getByAddress(current.b,current.s);
  }catch(e){
    console.log("error while getting by address - persistUsage()")  
    console.log(e)
   return  persistUsage(us)
  }
  let s = null;
  try{
    s = await repo.switchRepo.getSwitchByAddress(current.b,current.s)
  }catch (e){
    console.log('error while getting switch')
    console.log(e)
  }
  if(!s){
    return persistUsage(us)
  }
    if(!res){
      if(!current.off){
        try{
          let ob={}
          ob.lastOnTime = current.on;
          ob.switchId = s.id;
          ob.week = current.onweek.toString();
          let usage = await repo.usageRepository.create(ob)
        }catch (e){
          console.log('error while creating usage')
          console.log(e)
        }
      }
    }else{
      /*let ob = res
      if(res.lastOnTime){
          let lastWeek = moment(res.lastOnTime).week()
          let currentWeek = moment(current.on).week()
          days.map(m=>{
            if(lastWeek!=currentWeek && !us){
              ob[m] = null;
            }else if(!ob[m]){
              ob[m] = null;
            }
            return m;
          });
        }  */
      //on unexpected power off usage will be lost, because we're replacing on time
      if(!current.off){
          let currentWeekusage = res.filter(f=>f.week == current.onweek);
          if(currentWeekusage&&currentWeekusage.length){
            let ob = currentWeekusage[0];
            ob.lastOnTime=current.on;
            ob.switchId = parseInt(ob.switchId);
            ob.week = current.onweek.toString();
            try{
              let updatedUsage = await repo.usageRepository.update(ob);
            }catch(e){
              console.log('error while - persisting usage -update- no off in current')
              console.log(e)
            }
          }else{
            try{
              let ob={}
              ob.lastOnTime = current.on;
              ob.switchId = s.id;
              ob.week = current.onweek;
              let usage = await repo.usageRepository.create(ob)
            }catch (e){
              console.log('error while creating usage')
              console.log(e)
            }
          }
        
      }else{
        if(current.offweek==current.onweek){
          let currentWeekusage = res.filter(f=>f.week == current.onweek);
          if(currentWeekusage&&currentWeekusage.length){
            let ob = currentWeekusage[0];
            var duration = moment.duration(moment(current.off).diff(moment(current.on)));
            let currentDifference = duration.toJSON();
            let day = moment(current.on).day();
            if(!ob[days[day]]){
              ob[days[day]] = currentDifference;
            }else {
              ob[days[day]] = (moment.duration(ob[days[day]]).add(moment.duration(currentDifference))).toJSON();
            }
            ob.switchId = parseInt(ob.switchId);
            ob.lastOnTime = null;
            ob.week = current.onweek.toString();
            try{
              let updatedUsage = await repo.usageRepository.update(ob);
            }catch(e){
              console.log('error while - persisting usage -update-  off in current')
              console.log(e)
            }
          }
        }
      }
    }
    persisting =false;
    if(pendingStats.length){
    setTimeout(function(){
      persistUsage(us)
    })
    }
    setTimeout(function(){
      if(!persisting&&pendingStats.length){
        persistUsage(us)
      }
    },5000)
    /* else{
      if(us){
        usageSchedule = false;

      mailer()
      }
    } */
}



function mailer(){
  let currentWeek = moment(new Date()).week()
  console.log("week"+currentWeek)
  repo.switchRepo.getOldStats(currentWeek).then(res => {
    let weeks ={}
    if(res&&res.length){
      res.map(s=>{
        if(!weeks[s.week]){
          weeks[s.week]={};
          weeks[s.week].payload = {};
          weeks[s.week].payload.week=s.week;
          weeks[s.week].payload.switches =[];
        }
        let days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        let duration = null;
        days.map(d => {
            if(s[d]){
              if(!duration){
                duration = moment.duration(s[d]);
              }else{
                duration.add(moment.duration(s[d]))
              }
              s[d] = `${moment.duration(s[d]).hours()} hours, ${moment.duration(s[d]).minutes()} minutes and ${moment.duration(s[d]).seconds()} seconds`
              
              if(moment.duration(s[d]).days()){
                s[d] = `${moment.duration(s[d]).days()} days, ${moment.duration(s[d]).hours()} hours, ${moment.duration(s[d]).minutes()} minutes and ${moment.duration(s[d]).seconds()} seconds`
              }
            }
          return d
        })
        if(duration){
          s.duration = `${duration.hours()} hours, ${duration.minutes()} minutes and ${duration.seconds()} seconds`
          if(duration.days()){
            s.duration = `${duration.days()} days, ${duration.hours()} hours, ${duration.minutes()} minutes and ${duration.seconds()} seconds`
          }
        }
        weeks[s.week].payload.switches.push(s);
        return s
      });
      let weekKeys = Object.keys(weeks);
      if(weekKeys&&weekKeys.length){
        weekKeys.map(k=>{
          let payload = weeks[k].payload;
         payload.device = deviceId;
         let days = [1, 2, 3, 4, 5, 6, 7]
         .map(d => moment('2020-'+k+'-' + d, 'YYYY-W-E').format());
         payload.days = days;
          socket.emit('sendMail',payload);
          repo.switchRepo.getOnStats(k).then(res => {
            let onStats = null;
    
            if(res.length){
              console.log('###################on stats are present',res)
                onStats = res;
            }
            repo.usageRepository.clearUsage(k).then(resp=>{
              console.log("deleteeeed",res)
              console.log('###################on stats ',onStats)
             /*  if(onStats&&onStats.length){
                onStats.map(m=>{
                  if(m.lastOnTime){
                    if(!stats[m.board]){
                      stats[m.board] = {};
                    }
                    persisting = true;
                    stats[m.board][m.switch]={};
                    handleOnForTracking(m.board,m.switch,m.lastOnTime)
                    persisting=false;
                    persistUsage(false);
                  }
                  return m;
                })
              } */
            })
          })
          return k
        })
      }
      console.log('################### usages for mail ##############',weeks)
    
         
    }
  }, error => {
    //payload.error = 'error sending weekly mail'
  })
  console.log('send usage schedule mail');
}

function handleOnForTracking(b,s,on) {
  initStats(b,s);
  let current = stats[b][s].current;
  let pending = stats[b][s].pending;
  current.on = on?on:moment().format();
  current.off = null;
  current.onweek = new moment(current.on).week();
  current.offweek = null;
  pendingStats.push(JSON.parse(JSON.stringify(current)));
  if(pendingStats.length&&!persisting){
    persistUsage(false)
  }
}

function handleOffForTracking(b,s,off) {
  initStats(b,s);
 


  let current = stats[b][s].current;
  let pending = stats[b][s].pending;
  if(!current.on){
    return
  }
  current.off = off?off:moment().format();
  current.offweek = new moment(current.off).week();
  pendingStats.push(JSON.parse(JSON.stringify(current)));
  console.log("off stats .........")
  console.log(JSON.stringify(stats))
  console.log("off stats .........")
  current.on=null;
  current.off=null;
  current.onweek = null;
  current.offweek = null;
  
  if(pendingStats.length && !persisting){
    persistUsage(false)
  }

}


function setSchedules(){
  console.log("setting schedule")
  activeSchedules = {};
  repo.scheduleRepository.getAllActive().then(schedules => {
    processSchedules(schedules);
  },err=>{
    console.log(err)
  })
}


function setScheduleById(scheduleId){
  console.log("setting schedule by scheduleId")
  repo.scheduleRepository.getAllActiveById(scheduleId).then(schedules => {
    processSchedules(schedules);
  },err=>{
    console.log(err)
  })
}


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
  console.log("request to login")
  if(!req.body||!req.body.username||!req.body.password){
    console.log("error 1")

    return res.status(400).send({'error':'username and password are required'});
  }
  registrationService.login(req.body.username,req.body.password).then(function(user){
      if(user.error){
        console.log("error 2")

        return res.status(400).send({"error":"Bad Credentials"})
      }
      return res.status(200).send(user);
    },function(err){
      console.log("error 3")
      console.log(err)
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


  piWifi.scan((err,networks) => 
  {
    if(err){
      res.status(500).send({'error':[]})
    }
    console.log(networks)
    if(networks&&networks.length){
      console.log('networks length')

      return res.status(200).send({"networks":networks.filter(f=>f.ssid!='Infrastructure')})
    }
  })

});


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
  let msg = {
    name:req.body.ssid,
    password:req.body.password?req.body.password:null,
    device:deviceId
  }
  if(state.boards){
    let _boards = Object.keys(state.boards);
    _boards.map(b=>{
      console.log(b)
      console.log(msg)
      if(client){
        client.publish("penumats/"+b+"/wifi",JSON.stringify(msg));
      }
     // client.publish("penumats/"+b+"/wifi",base64data);

      return b
    })
  }
  var conn_info ={
    wifi_ssid:req.body.ssid,
    wifi_passcode:req.body.password?req.body.password:null
  }
  console.log("cinfo")
  console.log(conn_info)
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
    client.subscribe("penumats/register");
    client.subscribe("lwt");
  });
   
  client.on('message', function (topic, message,packet) {
    if(topic=="lwt"){
      console.log("last will received from "+ message);
      if(state.boards&&state.boards[message]){
        delete state.boards[message];
        let msg = {deviceId:deviceId,boards:state.boards}
        socket.emit("boards",msg);
      }

    }
    if(topic=="penumats/handshake/connect"&&!packet.retain){
      console.log("new nmcu handshake initiated");
      let id = JSON.parse(message.toString()).id;
      if(id && boards.indexOf(id)>=0){
        state.boards[id]=JSON.parse(message.toString());
       // console.log("board registered",JSON.stringify(state.boards));
        let msg = {deviceId:deviceId,boards:state.boards}
       socket.emit("boards",msg);

        if( currentBoard[id]){
          socket.emit("board_added", currentBoard[id]);
          delete currentBoard[id];
        }

      }else if(id){
        console.log(boards)
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

    if(topic=="penumats/register" && !packet.retain){
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      console.log("request to add board");
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");
      console.log("::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::");

      let id = message.toString();
      if(id && state.boards && !state.boards[id]){
        let msg = {deviceId:deviceId, boardId:id};
        socket.emit('addBoard',msg,function(res){
        //  console.log(res)
          if(res=="success"){
            console.log("board added in db")  
            socket.emit('getDeviceInfo2',deviceId);
          }

        });
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
            handleOffForTracking(board,$switch,null)
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
            handleOnForTracking(board,$switch,null)
          }else{
            console.log('bad request - board or switch not found')
          }
        }
      }
    })
    
  }

  

  setSchedules();

  
}


http.listen(3000, function(){
  console.log('listening on *:3000');
});