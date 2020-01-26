
var http = require('http');

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
                exec("sudo systemctl restart dhcpcd.service", function(err, stdout, stderr) {
                    if (!err) console.log("restart dhcpcd to connect to board ap");
                
                const options = {
                    hostname: '192.168.4.1',
                    port: 80,
                    path: '/register',
                    method: 'POST',
                    headers: {
                      'Content-Type': 'text/plain'
                    }
                  }
                  
                  const req = http.request(options, res => {
                    console.log(`statusCode: ${res.statusCode}`)
                  
                    res.on('data', d => {
                        console.log('register board returned success')
                      next_step();  
                    })
                  })
                  
                  req.on('error', error => {

                    console.error(error)
                    next_step();  
                  })
                  req.write(deviceId)  
                  req.end()  
                  
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