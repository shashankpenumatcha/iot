var wifiUtil = require('./wifi.js');
var fs = require("fs");


function checkHostname(){
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
      wifiUtil.write_template_to_file('./assets/etc/hosts.template','/etc/hosts',hostnameJSON,function(){
      //  shell.exec('reboot');
      });
    }else{
      deviceId = hostnameJSON.id;
    }
    console.log(deviceId);
    return deviceId;
  }
  
  module.exports = checkHostname;