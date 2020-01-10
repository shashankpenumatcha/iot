
class LocationRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL)`
      return this.dao.run(sql)
    }
    create(name) {
        return this.dao.run(
          'INSERT INTO locations (name) VALUES (?)',
          [name])
    }
    update(location) {
        const { id, name } = location
        return this.dao.run(
          `UPDATE locations SET name = ? WHERE id = ?`,
          [name, id]
        )
    }
    delete(id) {
        return this.dao.run(
            `DELETE FROM locations WHERE id = ?`,
            [id]
        )
    }
    getById(id) {
        return this.dao.get(
          `SELECT * FROM locations WHERE id = ?`,
          [id])
    }
    getAll() {
        return this.dao.all(`SELECT * FROM locations`)
    }
    
  }
  
  module.exports = LocationRepository;