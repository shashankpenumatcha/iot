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
          exec("sudo wpa_cli -i wlan0 reconfigure", function(error, stdout, stderr) {
              if (!error) console.log("wifi reset done");
              next_step();
          });
      }
     
  ], callback);
}

    // Disables AP mode and reverts to wifi connection
    _enable_wifi_mode = function(connection_info, callback) {
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
  };


  var conn_info = {
    wifi_ssid:'Shashanks',
    wifi_passcode:'meenakshi1234'
};


