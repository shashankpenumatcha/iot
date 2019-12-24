

var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var mqtt = require('mqtt')
var client  = mqtt.connect('mqtt://test.mosquitto.org')
var path = require('path');

let connections=[];
let state={};
state.boards={};
 
client.on('connect', function () {
  client.subscribe('penumats/handshake/connect',{qos:2,rh:false,rap:false}, function (err) {
    if (!err) {
      console.log('ready to shake hands');
      client.publish('penumats/handshake/reinitiate',"hi")
    }
  })
});
 
client.on('message', function (topic, message,packet) {
  if(topic=="penumats/handshake/connect"&&!packet.retain){
    console.log("new nmcu handshake initiated");
    let id = JSON.parse(message.toString()).id;
    if(id){
      state.boards[id]=JSON.parse(message.toString());
      console.log("board registered",JSON.stringify(state.boards));
    }
  }
});



app.get('/on',function(req,res){
  if(!req.query||!req.query.b||req.query.s==undefined||req.query.s==null){
    return res.status(400).send({error:"please check the query params"});
  }
  let board = req.query.b;
  let $switch = req.query.s;
  if(state.boards[board]&&state.boards[board].switches!=undefined&&state.boards[board].switches[$switch]!=undefined){
    client.publish("penumats/"+board+"/switch/on",JSON.stringify({switch:parseInt($switch),state:true}));
    res.status(200).send('on');
  }else{
    res.status(404).send({error:'board or switch not found'});
  }

})

app.get('/off',function(req,res){
  if(!req.query||!req.query.b||req.query.s==undefined||req.query.s==null){
    return res.status(400).send({error:"please check the query params"});
  }
  let board = req.query.b;
  let $switch = req.query.s;
  if(state.boards[board]&&state.boards[board].switches!=undefined&&state.boards[board].switches[$switch]!=undefined){
    client.publish("penumats/"+board+"/switch/off",JSON.stringify({switch:parseInt($switch),state:false}));
    res.status(200).send('off');
  }else{
    res.status(404).send({error:'board or switch not found'});
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
          ob.off="/on?b="+m+"&s="+index;
          ob.state = n;
          boards[m].switches.push(ob);
          return n;
      });
    }
    
    return m;
 });
 return res.status(200).send(boards);
})

app.use('/mqtt',express.static(path.join(__dirname,'node_modules/mqtt/dist')))
app.use(express.static('public'))
console.log(path.join(__dirname,'node_modeules/mqtt/dist'))





io.on('connection', function(socket){
  console.log('a user connected');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});