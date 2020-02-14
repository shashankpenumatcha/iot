
const AppDAO = require('./dao');
const LocationRepository = require('./repositories/location.repository');
const SwitchRepo = require('./repositories/switch.repository');
const ScheduleRepository = require('./repositories/schedule.repository');
const UsageRepository = require('./repositories/usage.repository')
const dao = new AppDAO('./database.sqlite3')

const locationRepo = new LocationRepository(dao)
const switchRepo = new SwitchRepo(dao)
const scheduleRepository = new ScheduleRepository(dao)
const usageRepository = new UsageRepository(dao)

async function initDB() {
    console.log(1111)
  try{
    await locationRepo.createTable();
    await switchRepo.createTable();
    await scheduleRepository.createTable();
    await scheduleRepository.createMappingTable();
    await usageRepository.createTable();
  }catch(e){
    console.log(e)
  }
 
}

initDB();

module.exports = {locationRepo, switchRepo, scheduleRepository};
