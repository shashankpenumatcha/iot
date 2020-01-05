

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var mqtt = require('mqtt')
var path = require('path');
var io = require('socket.io-client');
var socket = io.connect('http://shashank.local:3001', {reconnection: false,forceNew:true});
var fs = require("fs");
const bcrypt = require('bcrypt');
var Wifi = require('rpi-wifi-connection');
var wifi = new Wifi();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())



function error(error){
  return {"error":error};
}


//auth middleware
function auth(req,res,next){  
  console.log(req.header('Authorization'))
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


//
// wifi network selection code
//
var _       = require("underscore")._,
  async   = require("async"),
  fs      = require("fs"),
  exec    = require("child_process").exec

// Better template format
_.templateSettings = {
  interpolate: /\{\{(.+?)\}\}/g,
  evaluate :   /\{\[([\s\S]+?)\]\}/g
};
// Helper function to write a given template to a file based on a given
// context
function write_template_to_file(template_path, file_name, context, callback) {
  async.waterfall([

      function read_template_file(next_step) {
          fs.readFile(template_path, {encoding: "utf8"}, next_step);
      },

      function update_file(file_txt, next_step) {
       
          var template = _.template(file_txt)
          
          fs.writeFile(file_name, template(context), next_step);
      }

  ], callback);
}

_reboot_wireless_network = function(wlan_iface, callback) {
  async.series([
      function restart(next_step) {
          exec("sudo wpa_cli -i wlan0 reconfigure", function(err, stdout, stderr) {
              if (!err) console.log("wifi reset done");
              next_step();
          });
      }
     
  ], callback);
}

    // Disables AP mode and reverts to wifi connection
    _enable_wifi_mode = function(connection_info, callback) {
        if(!connection_info.passcode){
            async.series([
                //Add new network
                function update_wpa_supplicant(next_step) {
                  write_template_to_file(
                      "./assets/etc/wpa_supplicant/wpa_supplicant_NONE.conf.template",
                      "/etc/wpa_supplicant/wpa_supplicant.conf",
                      connection_info, next_step);
                  },
                  function reboot_network_interfaces(next_step) {
                      _reboot_wireless_network('wlan0', next_step);
                  },
              ], callback);
        }else{
            async.series([
                //Add new network
                function update_wpa_supplicant(next_step) {
                  write_template_to_file(
                      "./assets/etc/wpa_supplicant/wpa_supplicant.conf.template",
                      "/etc/wpa_supplicant/wpa_supplicant.conf",
                      connection_info, next_step);
                  },
                  function reboot_network_interfaces(next_step) {
                      _reboot_wireless_network('wlan0', next_step);
                  },
              ], callback);
        }

    
  };

//
// end wifi network selection code
//




//
// hostname setting
//

var shell = require('shelljs');
let deviceId;
let hostnameJSON
let hostnameFile = fs.readFileSync('./assets/hostname.json');


function write_template_to_file(template_path, file_name, context, callback) {
  async.waterfall([

      function read_template_file(next_step) {
          fs.readFile(template_path, {encoding: "utf8"}, next_step);
      },

      function update_file(file_txt, next_step) {
       
          var template = _.template(file_txt)
          
          fs.writeFile(file_name, template(context), next_step);
      }

  ], callback);
}

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
 write_template_to_file('./assets/etc/hosts.template','/etc/hosts',hostnameJSON,function(){
  shell.exec('reboot');

 })
 
}else{
  deviceId = hostnameJSON.id;
}
console.log(deviceId);
//
// end hostname setting
//




var device = null; //registered device from server
var boards = []; //registered boards from server
let connections=[];
let state={};
state.boards={};
let localusers  = getLocalUsers();


initDevice();


function login(username,password){
  var promise = new Promise(function(resolve, reject) { 
    if(username&&password&&localusers.length){
      let user = localusers.filter(f=>f.username==username);
      if(user&&user.length&&user[0].password){
          bcrypt.compare(password,user[0].password).then(function(res){
          if(res){
            resolve({"token":user[0].password})

          }else{
            reject(error("Bad Credentials two"))

          }
        })
      }
    }else{
      reject(error("Bad Credentials"))
    }
  }); 
  return promise
}
function resetPassword(username,password,oldPassword){
  var promise = new Promise(function(resolve,reject){
    if(!username||!password||!oldPassword){
      reject(error("Bad Request, all parameters are required"));
    }
    if(!localusers||!localusers.length){
      reject(error("no local users"));
    }
    let user = localusers.filter(f=>f.username==username);
    if(!user&&!user.length&&!user[0].password){
      reject(error("no user found with username "+username));
    }
    bcrypt.compare(oldPassword, user[0].password, function(err, res) {
        if(err){
          reject(error(err));
        }
        if(!res){
          reject(("invalid password"))
        }
        bcrypt.hash(password, 10, function(err, hash) {
          if(err){
            reject(error(err));
          }
          let users = getLocalUsers();
          if(!users.length){
            reject(error("no local users"));
          }
          let userNotFound = true;
          users = users.map(m=>{
            if(m.username==username){
              userNotFound=false;
              m.password=hash;
            }
            return m
          })
          if(userNotFound){
            reject(("user not found"))
          }
          localusers = users;
          fs.writeFileSync("./assets/auth.json",JSON.stringify(users));
          resolve({"message":"password reset succesfully"})
        });
        
    });
  })

  return promise
}

function getLocalUsers(){
  try{
    let rawdata = fs.readFileSync('./assets/auth.json');
    try{
      let jsondata= JSON.parse(rawdata);
      return jsondata
    }catch(e){
      return []
    } 
  }catch(e){
    console.log("error while fetching local user");
    console.log(e);
    return [];
  }
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
  
  app.post('/api/password/reset',auth,function(req,res){
    console.log(req.body)
    if(!req.body||!req.body.username||!req.body.password||!req.body.oldPassword){
      return res.status(400).send(error("Bad Request"))
    }
   
    resetPassword(req.body.username,req.body.password,req.body.oldPassword).then(function(reset){
      if(reset.message){
        return res.status(200).send(reset)
      }
    },function(err){
      return res.status(500).send(reset)

    })
  
  })

  app.post('/api/login',function(req,res){
    console.log(req.body)
    if(!req.body||!req.body.username||!req.body.password){
      return res.status(400).send({'error':'username and password are required'});
    }
      login(req.body.username,req.body.password).then(function(user){
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
    _enable_wifi_mode(conn_info, function(err) {
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
console.log(path.join(__dirname,'node_modeules/mqtt/dist'))

http.listen(3000, function(){
  console.log('listening on *:3000');
});