var fs = require("fs");
const bcrypt = require('bcrypt');

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

  module.exports = {login,resetPassword}