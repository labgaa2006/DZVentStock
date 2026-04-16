const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DB {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'dzventstock.db');
    this.SQL = null;
    this.db = null;
  }

  async initSQL() {
    if (this.SQL) return;
    const initSqlJs = require('sql.js');
    this.SQL = await initSqlJs();
    // تحميل قاعدة البيانات إذا موجودة
    if (fs.existsSync(this.dbPath)) {
      const data = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(data);
    } else {
      this.db = new this.SQL.Database();
    }
  }

  save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.save();
  }

  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  get(sql, params = []) {
    return this.all(sql, params)[0] || null;
  }

  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, ref TEXT UNIQUE, name TEXT NOT NULL,
        category TEXT DEFAULT '', unit TEXT DEFAULT 'قطعة',
        buy_price REAL DEFAULT 0, sell_price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0, stock_min INTEGER DEFAULT 5,
        barcode TEXT DEFAULT '', notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', notes TEXT DEFAULT '', balance REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS fournisseurs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ventes (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, client_id TEXT, client_name TEXT DEFAULT 'عميل نقدي',
        total REAL DEFAULT 0, discount REAL DEFAULT 0, tva REAL DEFAULT 0,
        net REAL DEFAULT 0, paid REAL DEFAULT 0, reste REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS vente_items (
        id TEXT PRIMARY KEY, vente_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1,
        price REAL DEFAULT 0, total REAL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS achats (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, fournisseur_id TEXT,
        fournisseur_name TEXT DEFAULT '', total REAL DEFAULT 0,
        paid REAL DEFAULT 0, reste REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS achat_items (
        id TEXT PRIMARY KEY, achat_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1,
        price REAL DEFAULT 0, total REAL DEFAULT 0
      );
    `);

    const defaults = [
      ['company_name','محل الأغواط للإلكترونيات'],['company_phone','0550 000 000'],
      ['company_address','الأغواط، الجزائر'],['tva','19'],['currency','DA'],
      ['paper_size','A4'],['stock_alert','1'],['vente_num_prefix','F'],
      ['vente_num_counter','1'],['achat_num_prefix','A'],['achat_num_counter','1'],
    ];
    defaults.forEach(([k,v]) => {
      this.db.run(`INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)`, [k,v]);
    });
    this.save();
  }

  // ===== PRODUCTS =====
  getAllProducts() {
    return this.all(`SELECT * FROM products WHERE is_deleted=0 ORDER BY name`);
  }
  addProduct(data) {
    const id = this.uuid();
    const count = this.get(`SELECT COUNT(*) as c FROM products`)?.c || 0;
    const ref = data.ref || `REF-${String(Number(count)+1).padStart(3,'0')}`;
    this.run(`INSERT INTO products (id,ref,name,category,unit,buy_price,sell_price,stock,stock_min,barcode,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [id,ref,data.name,data.category||'',data.unit||'قطعة',
       data.buy_price||0,data.sell_price||0,data.stock||0,data.stock_min||5,
       data.barcode||'',data.notes||'']);
    return { success:true, id };
  }
  updateProduct(id, data) {
    this.run(`UPDATE products SET name=?,category=?,unit=?,buy_price=?,sell_price=?,
      stock=?,stock_min=?,barcode=?,notes=?,updated_at=datetime('now') WHERE id=?`,
      [data.name,data.category||'',data.unit||'قطعة',data.buy_price||0,data.sell_price||0,
       data.stock||0,data.stock_min||5,data.barcode||'',data.notes||'',id]);
    return { success:true };
  }
  deleteProduct(id) {
    this.run(`UPDATE products SET is_deleted=1 WHERE id=?`, [id]);
    return { success:true };
  }
  searchProducts(q) {
    const like = `%${q}%`;
    return this.all(`SELECT * FROM products WHERE is_deleted=0
      AND (name LIKE ? OR ref LIKE ? OR barcode LIKE ? OR category LIKE ?) ORDER BY name`,
      [like,like,like,like]);
  }

  // ===== CLIENTS =====
  getAllClients() { return this.all(`SELECT * FROM clients WHERE is_deleted=0 ORDER BY name`); }
  addClient(data) {
    const id = this.uuid();
    this.run(`INSERT INTO clients(id,name,phone,address,notes) VALUES(?,?,?,?,?)`,
      [id,data.name,data.phone||'',data.address||'',data.notes||'']);
    return { success:true, id };
  }
  updateClient(id, data) {
    this.run(`UPDATE clients SET name=?,phone=?,address=?,notes=? WHERE id=?`,
      [data.name,data.phone||'',data.address||'',data.notes||'',id]);
    return { success:true };
  }
  deleteClient(id) {
    this.run(`UPDATE clients SET is_deleted=1 WHERE id=?`,[id]);
    return { success:true };
  }

  // ===== FOURNISSEURS =====
  getAllFournisseurs() { return this.all(`SELECT * FROM fournisseurs WHERE is_deleted=0 ORDER BY name`); }
  addFournisseur(data) {
    const id = this.uuid();
    this.run(`INSERT INTO fournisseurs(id,name,phone,address,notes) VALUES(?,?,?,?,?)`,
      [id,data.name,data.phone||'',data.address||'',data.notes||'']);
    return { success:true, id };
  }

  // ===== VENTES =====
  getAllVentes() {
    return this.all(`SELECT v.*, vi_sum.items FROM ventes v
      LEFT JOIN (SELECT vente_id, group_concat(product_name||' x'||qty,', ') as items
        FROM vente_items GROUP BY vente_id) vi_sum ON v.id=vi_sum.vente_id
      WHERE v.is_deleted=0 ORDER BY v.created_at DESC LIMIT 200`);
  }
  getVenteById(id) {
    const v = this.get(`SELECT * FROM ventes WHERE id=?`,[id]);
    if (!v) return null;
    v.items = this.all(`SELECT * FROM vente_items WHERE vente_id=?`,[id]);
    return v;
  }
  addVente(data) {
    const id = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='vente_num_counter'`)?.value || '1');
    const prefix = this.get(`SELECT value FROM settings WHERE key='vente_num_prefix'`)?.value || 'F';
    const num = `${prefix}${String(counter).padStart(5,'0')}`;

    this.db.run(`INSERT INTO ventes(id,num,client_id,client_name,total,discount,tva,net,paid,reste,payment_type,notes,date)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,num,data.client_id||null,data.client_name,data.total||0,data.discount||0,
       data.tva||0,data.net||0,data.paid||0,data.reste||0,data.payment_type,data.notes||'',data.date]);

    (data.items||[]).forEach(item => {
      this.db.run(`INSERT INTO vente_items(id,vente_id,product_id,product_name,ref,qty,price,total)
        VALUES(?,?,?,?,?,?,?,?)`,
        [this.uuid(),id,item.product_id||null,item.product_name,item.ref||'',
         item.qty,item.price,item.qty*item.price]);
      if (item.product_id) {
        this.db.run(`UPDATE products SET stock=stock-? WHERE id=?`,[item.qty,item.product_id]);
      }
    });
    this.db.run(`UPDATE settings SET value=? WHERE key='vente_num_counter'`,[String(counter+1)]);
    this.save();
    return { success:true, id, num };
  }

  // ===== ACHATS =====
  getAllAchats() {
    return this.all(`SELECT * FROM achats WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 200`);
  }
  addAchat(data) {
    const id = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='achat_num_counter'`)?.value || '1');
    const prefix = this.get(`SELECT value FROM settings WHERE key='achat_num_prefix'`)?.value || 'A';
    const num = `${prefix}${String(counter).padStart(5,'0')}`;

    this.db.run(`INSERT INTO achats(id,num,fournisseur_id,fournisseur_name,total,paid,reste,payment_type,notes,date)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [id,num,data.fournisseur_id||null,data.fournisseur_name||'',
       data.total||0,data.paid||0,data.reste||0,data.payment_type,data.notes||'',data.date]);

    (data.items||[]).forEach(item => {
      this.db.run(`INSERT INTO achat_items(id,achat_id,product_id,product_name,ref,qty,price,total)
        VALUES(?,?,?,?,?,?,?,?)`,
        [this.uuid(),id,item.product_id||null,item.product_name,item.ref||'',
         item.qty,item.price,item.qty*item.price]);
      if (item.product_id) {
        this.db.run(`UPDATE products SET stock=stock+?, buy_price=? WHERE id=?`,
          [item.qty,item.price,item.product_id]);
      }
    });
    this.db.run(`UPDATE settings SET value=? WHERE key='achat_num_counter'`,[String(counter+1)]);
    this.save();
    return { success:true, id, num };
  }

  // ===== STATS =====
  getDashboardStats() {
    const today = new Date().toISOString().slice(0,10);
    const month = today.slice(0,7);
    return {
      products_count:  this.get(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0`)?.c || 0,
      low_stock_count: this.get(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0 AND stock<=stock_min AND stock>0`)?.c || 0,
      out_of_stock:    this.get(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0 AND stock=0`)?.c || 0,
      clients_count:   this.get(`SELECT COUNT(*) as c FROM clients WHERE is_deleted=0`)?.c || 0,
      ventes_today:    this.get(`SELECT COUNT(*) as c FROM ventes WHERE is_deleted=0 AND date=?`,[today])?.c || 0,
      ventes_month:    this.get(`SELECT COUNT(*) as c FROM ventes WHERE is_deleted=0 AND date LIKE ?`,[`${month}%`])?.c || 0,
      ca_today:        this.get(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 AND date=?`,[today])?.s || 0,
      ca_month:        this.get(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 AND date LIKE ?`,[`${month}%`])?.s || 0,
      ca_total:        this.get(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0`)?.s || 0,
      recent_ventes:   this.all(`SELECT v.* FROM ventes v WHERE v.is_deleted=0 ORDER BY v.created_at DESC LIMIT 5`),
      low_stock_products: this.all(`SELECT * FROM products WHERE is_deleted=0 AND stock<=stock_min ORDER BY stock ASC LIMIT 5`),
    };
  }

  getReports(period='month') {
    const now = new Date();
    let f = '';
    if (period==='today') f = `AND date='${now.toISOString().slice(0,10)}'`;
    else if (period==='month') f = `AND date LIKE '${now.toISOString().slice(0,7)}%'`;
    else if (period==='year') f = `AND date LIKE '${now.getFullYear()}%'`;
    return {
      total_ventes:  this.get(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 ${f}`)?.s || 0,
      total_achats:  this.get(`SELECT COALESCE(SUM(total),0) as s FROM achats WHERE is_deleted=0 ${f}`)?.s || 0,
      top_products:  this.all(`SELECT product_name, SUM(qty) as total_qty, SUM(total) as total_amount
        FROM vente_items vi JOIN ventes v ON v.id=vi.vente_id WHERE v.is_deleted=0 ${f}
        GROUP BY product_name ORDER BY total_qty DESC LIMIT 10`),
      payment_types: this.all(`SELECT payment_type, COUNT(*) as count, SUM(net) as total
        FROM ventes WHERE is_deleted=0 ${f} GROUP BY payment_type`),
    };
  }

  // ===== SETTINGS =====
  getSettings() {
    const rows = this.all(`SELECT key, value FROM settings`);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
  saveSettings(data) {
    Object.entries(data).forEach(([k,v]) => {
      this.db.run(`INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)`,[k,v]);
    });
    this.save();
    return { success:true };
  }
}

module.exports = DB;
