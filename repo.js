
const AppDAO = require('./dao');
const LocationRepository = require('./repositories/location.repository');
const SwitchRepo = require('./repositories/switch.repository');
const dao = new AppDAO('./database.sqlite3')
const locationRepo = new LocationRepository(dao)
const switchRepo = new SwitchRepo(dao)

async function initDB() {
    console.log(1111)
  try{
    await locationRepo.createTable();
    await switchRepo.createTable();
  }catch(e){
    console.log(e)
  }
 
}

initDB();

module.exports = {locationRepo, switchRepo};
