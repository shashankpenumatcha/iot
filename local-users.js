var fs = require("fs");

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

  module.exports = getLocalUsers;