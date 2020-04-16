
class LocationRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        locationLogo TEXT,
        locationId TEXT NOT NULL)`
      return this.dao.run(sql)
    }
    create(name, locationId, locationLogo) {
        return this.dao.run(
          'INSERT INTO locations (name, locationId, locationLogo) VALUES (?, ?, ?)',
          [name, locationId, locationLogo])
    }
    update(location) {
        const { id, name , locationId, locationLogo } = location
        return this.dao.run(
          `UPDATE locations SET name = ? , locationId= ?, locationLogo=? WHERE id = ?`,
          [name, locationId,locationLogo, id]
        )
    }
    updateName(location) {
      const { name , locationId } = location
      return this.dao.run(
        `UPDATE locations SET name = ?  WHERE locationId = ?`,
        [name, locationId]
      )
    }

  updateLogo(location) {
      const { locationLogo , locationId } = location
      return this.dao.run(
        `UPDATE locations SET locationLogo = ?  WHERE locationId = ?`,
        [locationLogo, locationId]
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