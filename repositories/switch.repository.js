
class SwitchRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS switches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        switchLogo TEXT,
        board TEXT NOT NULL,
        switch INTEGER NOT NULL,
        locationId INTEGER,
        CONSTRAINT tasks_fk_locationId FOREIGN KEY (locationId)
          REFERENCES locations(id) ON UPDATE CASCADE ON DELETE CASCADE)`
      return this.dao.run(sql)
    }
    create(name, board, swtch, locationId,switchLogo) {
        return this.dao.run(
          `INSERT INTO switches (name, board, switch, switchLogo, locationId)
            VALUES (?, ?, ?, ?,?)`,
          [name, board, swtch,switchLogo, locationId])
    }
    update(swtch) {
        const { id, name, board, sw, locationId, switchLogo } = swtch
        return this.dao.run(
          `UPDATE switches
          SET name = ?,
            board = ?,
            swtch = ?,
            locationId = ?,
            switchLogo ?
          WHERE id = ?`,
          [name, board, sw, locationId,switchLogo, id]
        )
    }
    updateName(swtch) {
      const { id, name } = swtch
      return this.dao.run(
        `UPDATE switches
        SET name = ? WHERE id = ?`,
        [name,id]
      )
  }
  updateLogo(swtch) {
    const { id, switchLogo } = swtch
    return this.dao.run(
      `UPDATE switches
      SET switchLogo = ? WHERE id = ?`,
      [switchLogo,id]
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
      return this.dao.all(`select switches.id,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId, locations.locationLogo, switches.switchLogo from switches join locations on locations.id = switches.locationId`)
    }

    getStats() {
      return this.dao.all(`select u.id, u.switchId,u.monday,u.tuesday,u.wednesday,u.thursday,u.friday,u.saturday,u.sunday,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId from switches join locations on locations.id = switches.locationId
       join usage u on u.switchId = switches.id`)
    }
    getOldStats(w) {
      return this.dao.all(`select u.id, u.switchId,u.monday,u.tuesday,u.wednesday,u.thursday,u.friday,u.saturday,u.sunday,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId from switches join locations on locations.id = switches.locationId
       join usage u on u.switchId = switches.id AND u.week != w`)
    }

    getOnStats(week) {
      return this.dao.all(`select u.id, u.lastOnTime, u.switchId,u.monday,u.tuesday,u.wednesday,u.thursday,u.friday,u.saturday,u.sunday,switches.name,switches.board,switches.switch,locations.name as locationName, locations.locationId from switches join locations on locations.id = switches.locationId
       join usage u on u.switchId = switches.id where u.lastOnTime IS NOT NULL AND u.week = ?`,[week])
    }
  }
  
  module.exports = SwitchRepository;