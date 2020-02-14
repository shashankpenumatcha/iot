
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
        CONSTRAINT usage_switch_fk_switchId FOREIGN KEY (switchId)
        REFERENCES switches(id) ON UPDATE CASCADE ON DELETE CASCADE)`
      return this.dao.run(sql)
    }
    create(usage) {
      const {monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId} = usage;
        return this.dao.run(
          'INSERT INTO usage (monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId) VALUES (?, ?,?,?,?,?,?,?,?)',
          [monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId])
    }
    update(usage) {
      const {monday,tuesday,wednesday,thursday,friday,saturday,sunday,lastOnTime,switchId} = usage;
      console.log(switchId)
        return this.dao.run(
          `UPDATE usage SET monday = ? WHERE switchId = ?`,
          [monday,switchId])
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
            `DELETE FROM usage WHERE id = ?`,
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

    getByAddress(b,s) {
      return this.dao.get(
        `SELECT * FROM usage u join switches s on s.id = u.switchId WHERE s.board = ? and s.switch = ?`,
        [b,s])
  }
    
  }
  
  module.exports = UsageRepository;