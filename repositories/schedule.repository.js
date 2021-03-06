
class ScheduleRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheduleId STRING NOT NULL,
        name TEXT,
        active BOOLEAN NOT NULL,
        startDate TEXT,
        weekly BOOLEAN,
        date TEXT,
        days TEXT,
        start TEXT NOT NULL,
        end TEXT NOT NULL)`
     
      return this.dao.run(sql)
    }
    createMappingTable(){
      const sql = `
      CREATE TABLE IF NOT EXISTS schedules_switch_mapping (
        switchId INTEGER NOT NULL,
        scheduleId INTEGER NOT NULL,
        CONSTRAINT schedules_switch_fk_switchId FOREIGN KEY (switchId)
          REFERENCES switches(id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT schedules_switch_fk_scheduleId FOREIGN KEY (scheduleId)
          REFERENCES schedules(id) ON UPDATE CASCADE ON DELETE CASCADE)`
      return this.dao.run(sql)
    }

    addMapping(switchId, scheduleId) {
      return this.dao.run(
        `INSERT INTO schedules_switch_mapping (switchId,scheduleId)
          VALUES (?, ?)`,
        [switchId,scheduleId])
  }

  delete(switchId, scheduleId) {
    return this.dao.run(
      `DELETE schedules_switch_mapping schedules WHERE switchId = ? AND scheduleId = ?`,
      [switchId, scheduleId]
    )
}
    create(scheduleId,name, active, startDate, weekly, date, days, start, end) {
        return this.dao.run(
          `INSERT INTO schedules (scheduleId,name, active, startDate, weekly, date, days, start, end) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scheduleId, name, active, startDate, weekly, date, days, start, end])
    }
    update(schedule) {
        const { id,scheduleId, name, active, startDate, weekly, date, days, start, end} = schedule
        return this.dao.run(
          `UPDATE schedules
            SET scheduleId = ?,
            name = ?,
            active = ?,
            startDate =?,
            weekly = ?,
            date = ?,
            days = ?,
            start = ?,
            end = ? 
          WHERE id = ?`,
          [id,scheduleId, name, active, startDate, weekly, date, days, start, end]
        )
    }
    delete(scheduleId) {
        return this.dao.run(
          `DELETE FROM schedules WHERE scheduleId = ?`,
          [scheduleId]
        )
    }
    deleteById(id) {
      return this.dao.all(
        `DELETE from schedules where scheduleId = ?`,
        [id])
    }
    getAllById(id) {
        return this.dao.all(
          `SELECT s.*, sw.id as sw_id,sw.name as sw_name,sw.board,sw.locationId, sw.switch FROM schedules s INNER JOIN
          schedules_switch_mapping ssm on ssm.scheduleid = s.id INNER JOIN
           switches sw on sw.id = ssm.switchid where s.scheduleId = ?`,
          [id])
    }
    getAll() {
        return this.dao.all(`SELECT s.*, l.name as location_name,l.locationLogo, sw.switchLogo, sw.id as sw_id,sw.name as sw_name,sw.board,sw.locationId, sw.switch FROM schedules s INNER JOIN
        schedules_switch_mapping ssm on ssm.scheduleid = s.id INNER JOIN
         switches sw on sw.id = ssm.switchid INNER JOIN 
         locations l on l.id = sw.locationId `)
    }

    getAllActive() {
      return this.dao.all(`SELECT s.*, sw.id as sw_id,sw.name as sw_name,sw.board,sw.locationId, sw.switch FROM schedules s INNER JOIN
      schedules_switch_mapping ssm on ssm.scheduleid = s.id INNER JOIN
       switches sw on sw.id = ssm.switchid where active = 1`)
    }

    getAllActiveById(scheduleId) {
      return this.dao.all(`SELECT s.*, sw.id as sw_id,sw.name as sw_name,sw.board,sw.locationId, sw.switch FROM schedules s INNER JOIN
      schedules_switch_mapping ssm on ssm.scheduleid = s.id INNER JOIN
       switches sw on sw.id = ssm.switchid where active = 1 AND s.scheduleId = ?`,
       [scheduleId])
    }

    updateActiveById(active, scheduleId) {
      return this.dao.run(
        `UPDATE schedules SET active = ? where scheduleId= ?`,
        [active, scheduleId]
      )
    }
 
  }
  
  module.exports = ScheduleRepository;