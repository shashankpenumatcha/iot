var rp = require('request-promise');

var http = require('http');
var Wifi = require('rpi-wifi-connection');
var piWifi = require('pi-wifi');

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
var wifi = new Wifi();
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
        console.log("connectionInfo")
        console.log(connection_info)
        if(!connection_info.wifi_passcode){
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

   // Disables AP mode and reverts to wifi connection
   _add_board = function(connection_info,deviceId, callback) {
    if(!connection_info.passcode){
        async.series([
            function backup_file(next_step){
                exec("sudo mv /etc/wpa_supplicant/wpa_supplicant.conf /etc/wpa_supplicant.conf", function(err, stdout, stderr) {
                    if (!err) console.log("backup wpa supplicant");
                    next_step();
                });
            },
    
            //Add new network
            function update_wpa_supplicant(next_step) {
              write_template_to_file(
                  "./assets/etc/wpa_supplicant/wpa_supplicant_NONE.conf.template",
                  "/etc/wpa_supplicant/wpa_supplicant.conf",
                  connection_info, next_step);
              },
              
              function add_board_http(next_step) {
                   console.log(connection_info.wifi_ssid)
                   
                  exec("sudo systemctl restart dhcpcd.service", function(err, stdout, stderr) {
                    if (!err) console.log("restart dhcpcd to connect to board ap");
                   var checkStatus = function(){
                        wifi.getState().then((connected) => {
                            if (connected){
                                console.log('Connected to network.');
                                piWifi.status('wlan0', function(err, status) {
                                    if (err) {
                                       console.error(err.message);
                                       return next_step();
                                    }
                                    console.log(status);
                                   // return next_step();
                                   if( status && status.wpa_state && (status.wpa_state== 'ASSOCIATING'||status.wpa_state== 'SCANNING')){
                                        setTimeout(function(){
                                            checkStatus();
                                        },5000)
                                   }else if(status && status.wpa_state && (status.wpa_state== 'COMPLETED')&& (status.ssid== connection_info.wifi_ssid)){
                                    var options = {
                                        method: 'POST',
                                        uri: 'http://192.168.4.1/register',
                                        body: deviceId,
                                        json: false // Automatically stringifies the body to JSON
                                    };
                                    setTimeout(function(){

                                        rp(options)
                                           .then(function (parsedBody) {
                                               console.log(parsedBody);
                                           console.log('register board returned success')
                                               // POST succeeded...
                                               next_step();  
                   
                                           })
                                           .catch(function (err) {
                                               // POST failed...
                                               console.log(err)
                                               console.error('err')
                                               next_step();  
                   
                                             
                                           }); 
                                    },5000)
                                   }else{
                                       next_step()
                                   }
                                  });
                              
                 
                
                 
                            }
                        }).catch((error) => {
                            setTimeout(function(){
                                checkStatus();
                                console.log(error);


                            },5000)

                        });
                    }
                 
                
                    checkStatus();
                  
                    
                  
                  
                  
                  
                })  
                           
                },
                function delet(next_step){
                    exec("sudo rm /etc/wpa_supplicant/wpa_supplicant.conf", function(err, stdout, stderr) {
                        if (!err) console.log(" deleting wpa_supplicant");
                        exec("sudo mv /etc/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf", function(err, stdout, stderr) {
                            if (!err) console.log(" replacing wpa_supplicant");
                            exec("sudo systemctl restart dhcpcd.service", function(err, stdout, stderr) {
                                if (!err) console.log(" resetting dhcpcd");
                                next_step();
                            }); 
                        }); 
                    }); 
                }
          ], callback);
    }
};

//
// end wifi network selection code
//

module.exports={
  write_template_to_file:write_template_to_file,
  _reboot_wireless_network:_reboot_wireless_network,
  _enable_wifi_mode:_enable_wifi_mode,
  _add_board:_add_board
}