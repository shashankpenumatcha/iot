
class SwitchRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS switches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        board TEXT NOT NULL,
        switch INTEGER NOT NULL,
        locationId INTEGER,
        CONSTRAINT tasks_fk_locationId FOREIGN KEY (locationId)
          REFERENCES locations(id) ON UPDATE CASCADE ON DELETE CASCADE)`
      return this.dao.run(sql)
    }
    create(name, board, swtch, locationId) {
        return this.dao.run(
          `INSERT INTO switches (name, board, switch, locationId)
            VALUES (?, ?, ?, ?)`,
          [name, board, swtch, locationId])
    }
    update(swtch) {
        const { id, name, board, sw, locationId } = swtch
        return this.dao.run(
          `UPDATE switches
          SET name = ?,
            board = ?,
            swtch = ?,
            locationId = ?
          WHERE id = ?`,
          [name, board, sw, locationId, id]
        )
    }
    delete(id) {
        return this.dao.run(
          `DELETE FROM switches WHERE id = ?`,
          [id]
        )
    }
    getById(id) {
        return this.dao.get(
          `SELECT * FROM switches WHERE id = ?`,
          [id])
    }
    getAll() {
        return this.dao.all(`SELECT * FROM switches`)
    }
    getSwitchesByLocation(locationId) {
        return this.dao.all(
          `SELECT * FROM switches WHERE locationId = ?`,
          [locationId])
    }
    getSwitchByAddress(board,swtch) {
      return this.dao.get(
        `SELECT * FROM switches WHERE board = ? AND switch = ?`,
        [board, swtch])
    }
    
    getLocations() {
      return this.dao.all(`select switches.id,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId from switches join locations on locations.id = switches.locationId`)
    }

    getStats() {
      return this.dao.all(`select u.id, u.switchId,u.monday,u.tuesday,u.wednesday,u.thursday,u.friday,u.saturday,u.sunday,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId from switches join locations on locations.id = switches.locationId
       join usage u on u.switchId = switches.id`)
    }
  }
  
  module.exports = SwitchRepository;