
class LocationRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        locationId TEXT NOT NULL)`
      return this.dao.run(sql)
    }
    create(name, locationId) {
        return this.dao.run(
          'INSERT INTO locations (name, locationId) VALUES (?, ?)',
          [name, locationId])
    }
    update(location) {
        const { id, name , locationId } = location
        return this.dao.run(
          `UPDATE locations SET name = ? , locationId= ? WHERE id = ?`,
          [name, locationId, id]
        )
    }
    delete(locationId) {
        return this.dao.run(
            `DELETE FROM locations WHERE locationId = ?`,
            [locationId]
        )
    }
    getById(locationId) {
        return this.dao.get(
          `SELECT * FROM locations WHERE locationId = ?`,
          [locationId])
    }
    getAll() {
        return this.dao.all(`SELECT * FROM locations`)
    }


    
  }
  
  module.exports = LocationRepository;