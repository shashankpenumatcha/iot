
class ScheduleRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        active BOOLEAN NOT NULL,
        startDate TEXT,
        weekly BOOLEAN,
        date TEXT,
        days TEXT,
        start TEXT NOT NULL,
        end TEXT NOT NULL,`
     
      return this.dao.run(sql)
    }
    createMappingTable(){
      const sql = `
      CREATE TABLE IF NOT EXISTS schedules_switch_mapping (
        switchId INTEGER NOT NULL,
        scheduleId INTEGER NOT NULL,
        CONSTRAINT schedules_switch_fk_switchId FOREIGN KEY (switchId)
          REFERENCES switches(id) ON UPDATE CASCADE ON DELETE CASCADE),
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
    create(name, active, startDate, weekly, date, days, start, end) {
        return this.dao.run(
          `INSERT INTO schedules (name, board, switchId, active, startDate, weekly, date, days, start, end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, active, startDate, weekly, date, days, start, end])
    }
    update(schedule) {
        const { id, name, active, startDate, weekly, date, days, start, end} = swtch
        return this.dao.run(
          `UPDATE schedules
            SET name = ?,
            active = ?,
            startDate =?,
            weekly = ?,
            date = ?,
            days = ?,
            start = ?,
            end = ? 
          WHERE id = ?`,
          [id, name, active, startDate, weekly, date, days, start, end]
        )
    }
    delete(id) {
        return this.dao.run(
          `DELETE FROM schedules WHERE id = ?`,
          [id]
        )
    }
    getById(id) {
        return this.dao.get(
          `SELECT * FROM schedules WHERE id = ?`,
          [id])
    }
    getAll() {
        return this.dao.all(`SELECT * FROM schedules`)
    }

    getAllActive() {
      return this.dao.all(`SELECT * FROM schedules where active = true`)
    }
    
 
  }
  
  module.exports = ScheduleRepository;