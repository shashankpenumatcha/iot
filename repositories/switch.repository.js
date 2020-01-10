
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
          `INSERT INTO tasks (name, board, switch, locationId)
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
          `SELECT * FROM projects WHERE id = ?`,
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
        `SELECT * FROM projects WHERE board = ? AND switch = ?`,
        [id, swtch])
    }
    
  }
  
  module.exports = SwitchRepository;