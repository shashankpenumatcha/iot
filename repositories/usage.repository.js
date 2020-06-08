
class UsageRepository {
    constructor(dao) {
      this.dao = dao
    }
  
    createTable() {
      const sql = `
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monday TEXT,
        tuesday TEXT,
        wednesday TEXT,
        thursday TEXT,
        friday TEXT,
        saturday TEXT,
        sunday TEXT,
        lastOnTime TEXT,
        switchId TEXT NOT NULL,
        week TEXT NOT NULL,
        CONSTRAINT usage_switch_fk_switchId FOREIGN KEY (switchId)
        REFERENCES switches(id) ON UPDATE CASCADE ON DELETE CASCADE)`
      return this.dao.run(sql)
    }
    create(usage) {
      const {monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId,week} = usage;
        return this.dao.run(
          'INSERT INTO usage (monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId,week) VALUES (?, ?,?,?,?,?,?,?,?,?)',
          [monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId,week])
    }
    update(usage) {
      const {monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId,week} = usage;
        return this.dao.run(
          `UPDATE usage SET monday =? , 
          tuesday =?, 
          wednesday = ?,
          thursday = ?,
          friday = ?,
          saturday = ?,
          sunday = ?,
          lastOnTime = ? 
           WHERE switchId = ? AND week = ?`,
          [monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId,week])
    }
    patch(usage,id) {
      let keys = Object.keys(usage);
      if(!keys.length){
        return
      }

        return this.dao.run(
          `UPDATE usage SET ${keys[0]}= ? WHERE id = ?`,
          [usage[keys[0]], id]
        )
    }
    delete(id) {
        return this.dao.run(
            `DELETE FROM usage WHERE switchId = ?`,
            [id]
        )
    }
    getById(switchId) {
        return this.dao.get(
          `SELECT * FROM usage WHERE switchId = ?`,
          [switchId])
    }
    getAll() {
        return this.dao.all(`SELECT * FROM usage`)
    }

    getAllOn() {
      return this.dao.all(`SELECT * FROM usage  where lastOnTime IS NOT NULL`)
    }
    clearOn() {
      return this.dao.run(`UPDATE usage SET lastOnTime = NULL`) 
    }

    getByAddress(b,s) {
      return this.dao.all(
        `SELECT * FROM usage u join switches s on s.id = u.switchId WHERE s.board = ? and s.switch = ?`,
        [b,s])
  }
  clearUsage(w) {
      return this.dao.run(`DELETE from usage WHERE week = ?`,[w])
  }
    
  }
  
  module.exports = UsageRepository;