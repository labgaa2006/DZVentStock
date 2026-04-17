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
    // Use exec() for multi-statement DDL — sql.js supports multiple statements in exec()
    const tables = [
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, ref TEXT UNIQUE, name TEXT NOT NULL,
        category TEXT DEFAULT '', unit TEXT DEFAULT 'قطعة',
        buy_price REAL DEFAULT 0,
        margin_pct REAL DEFAULT 0,
        tva_pct REAL DEFAULT 0,
        sell_price REAL DEFAULT 0,
        sell_price_semi REAL DEFAULT 0,
        sell_price_gros REAL DEFAULT 0,
        sell_price_super REAL DEFAULT 0,
        stock INTEGER DEFAULT 0, stock_min INTEGER DEFAULT 5,
        emplacement TEXT DEFAULT '',
        expiry_date TEXT DEFAULT '',
        expiry_alert INTEGER DEFAULT 0,
        favorite INTEGER DEFAULT 0,
        barcode TEXT DEFAULT '',
        barcode2 TEXT DEFAULT '', barcode3 TEXT DEFAULT '',
        barcode4 TEXT DEFAULT '', barcode5 TEXT DEFAULT '',
        barcode6 TEXT DEFAULT '', barcode7 TEXT DEFAULT '',
        barcode8 TEXT DEFAULT '',
        image_data TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', notes TEXT DEFAULT '', balance REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS fournisseurs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT DEFAULT '',
        address TEXT DEFAULT '', notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS ventes (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, client_id TEXT, client_name TEXT DEFAULT 'عميل نقدي',
        total REAL DEFAULT 0, discount REAL DEFAULT 0, tva REAL DEFAULT 0,
        net REAL DEFAULT 0, paid REAL DEFAULT 0, reste REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS vente_items (
        id TEXT PRIMARY KEY, vente_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1,
        price REAL DEFAULT 0, total REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS achats (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, fournisseur_id TEXT,
        fournisseur_name TEXT DEFAULT '', total REAL DEFAULT 0,
        paid REAL DEFAULT 0, reste REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS achat_items (
        id TEXT PRIMARY KEY, achat_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1,
        price REAL DEFAULT 0, total REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, client_id TEXT, client_name TEXT DEFAULT '',
        total REAL DEFAULT 0, discount REAL DEFAULT 0, tva REAL DEFAULT 0, net REAL DEFAULT 0,
        status TEXT DEFAULT 'معلق', notes TEXT DEFAULT '', validity_days INTEGER DEFAULT 30,
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY, quote_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1, price REAL DEFAULT 0, total REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS caisse (
        id TEXT PRIMARY KEY, type TEXT DEFAULT 'entrée', montant REAL DEFAULT 0,
        description TEXT DEFAULT '', ref_id TEXT DEFAULT '', ref_type TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS retours (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, vente_id TEXT, client_name TEXT DEFAULT '',
        total REAL DEFAULT 0, notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS retour_items (
        id TEXT PRIMARY KEY, retour_id TEXT, product_id TEXT,
        product_name TEXT, qty INTEGER DEFAULT 1, price REAL DEFAULT 0, total REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS loyalty (
        id TEXT PRIMARY KEY, client_id TEXT UNIQUE, client_name TEXT,
        points INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, level TEXT DEFAULT 'عادي',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS expiry (
        id TEXT PRIMARY KEY, product_id TEXT, product_name TEXT,
        batch_num TEXT DEFAULT '', qty INTEGER DEFAULT 0,
        expiry_date TEXT NOT NULL, notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT DEFAULT '',
        phone TEXT DEFAULT '', manager TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
        role TEXT DEFAULT 'cashier', password TEXT DEFAULT '1234',
        is_active INTEGER DEFAULT 1, last_login TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, type TEXT DEFAULT 'info', title TEXT NOT NULL,
        message TEXT DEFAULT '', is_read INTEGER DEFAULT 0, ref_id TEXT DEFAULT '',
        ref_screen TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS debt_payments (
        id TEXT PRIMARY KEY, vente_id TEXT, client_name TEXT,
        amount REAL DEFAULT 0, notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')))`,
    ];

    // Run each CREATE TABLE separately — guaranteed to work in sql.js
    tables.forEach(sql => {
      try { this.db.run(sql); } catch(e) { console.error('Table create error:', e.message); }
    });

    // Migration: add new columns to existing DBs
    const migrations = [
      `ALTER TABLE products ADD COLUMN margin_pct REAL DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN tva_pct REAL DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN sell_price_semi REAL DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN sell_price_gros REAL DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN sell_price_super REAL DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN emplacement TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN expiry_date TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN expiry_alert INTEGER DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN favorite INTEGER DEFAULT 0`,
      `ALTER TABLE products ADD COLUMN barcode2 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode3 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode4 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode5 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode6 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode7 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN barcode8 TEXT DEFAULT ''`,
      `ALTER TABLE products ADD COLUMN image_data TEXT DEFAULT ''`,
    ];
    migrations.forEach(sql => {
      try { this.db.run(sql); } catch(e) {} // ignore "duplicate column" errors
    });

    // Settings defaults
    const defaults = [
      ['company_name','محل الأغواط للإلكترونيات'],['company_phone','0550 000 000'],
      ['company_address','الأغواط، الجزائر'],['tva','19'],['currency','DA'],
      ['paper_size','A4'],['stock_alert','1'],['vente_num_prefix','F'],
      ['vente_num_counter','1'],['achat_num_prefix','A'],['achat_num_counter','1'],
      ['tva_enabled','0'],['quote_num_prefix','D'],['quote_num_counter','1'],
      ['retour_num_prefix','R'],['retour_num_counter','1'],
      ['login_enabled','0'],
    ];
    defaults.forEach(([k,v]) => {
      try { this.db.run(`INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)`, [k,v]); } catch(e) {}
    });

    // Default units
    try {
      const defaultUnits = ['قطعة','كغ','لتر','متر','علبة','كرتون','جهاز','طقم','زوج','دزينة'];
      defaultUnits.forEach((u,i) => {
        this.db.run(`INSERT OR IGNORE INTO units(id,name) VALUES(?,?)`,
          ['unit-'+i, u]);
      });
    } catch(e) {}

    // Default branch
    try {
      this.db.run(`INSERT OR IGNORE INTO branches(id,name,address,phone,manager) VALUES(?,?,?,?,?)`,
        ['branch-main','الفرع الرئيسي','الأغواط','0550 000 000','المدير']);
    } catch(e) {}

    // Default admin user — always ensure it exists
    try {
      this.db.run(`INSERT OR IGNORE INTO users(id,username,name,role,password,is_active) VALUES(?,?,?,?,?,?)`,
        ['user-admin','admin','مدير النظام','admin','admin123',1]);
    } catch(e) { console.error('Admin insert error:', e.message); }

    this.save();
  }

  // ===== PRODUCTS =====
  getAllProducts() {
    return this.all(`SELECT * FROM products WHERE is_deleted=0 ORDER BY name`);
  }
  // Units CRUD
  getAllUnits() { return this.all(`SELECT * FROM units ORDER BY name`); }
  addUnit(name) {
    const id = this.uuid();
    try {
      this.run(`INSERT INTO units(id,name) VALUES(?,?)`,[id,name]);
      return { success:true, id };
    } catch(e) { return { success:false, error:'الوحدة موجودة مسبقاً' }; }
  }
  deleteUnit(id) { this.run(`DELETE FROM units WHERE id=?`,[id]); return {success:true}; }
  addProduct(data) {
    const id = this.uuid();
    const count = this.get(`SELECT COUNT(*) as c FROM products`)?.c || 0;
    const ref = data.ref || `REF-${String(Number(count)+1).padStart(3,'0')}`;
    this.run(`INSERT INTO products
      (id,ref,name,category,unit,buy_price,margin_pct,tva_pct,
       sell_price,sell_price_semi,sell_price_gros,sell_price_super,
       stock,stock_min,emplacement,expiry_date,expiry_alert,favorite,
       barcode,barcode2,barcode3,barcode4,barcode5,barcode6,barcode7,barcode8,
       image_data,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, ref, data.name,
       data.category||'', data.unit||'قطعة',
       data.buy_price||0, data.margin_pct||0, data.tva_pct||0,
       data.sell_price||0, data.sell_price_semi||0,
       data.sell_price_gros||0, data.sell_price_super||0,
       data.stock||0, data.stock_min||5,
       data.emplacement||'', data.expiry_date||'', data.expiry_alert||0,
       data.favorite||0,
       data.barcode||'', data.barcode2||'', data.barcode3||'',
       data.barcode4||'', data.barcode5||'', data.barcode6||'',
       data.barcode7||'', data.barcode8||'',
       data.image_data||'', data.notes||'']);
    return { success:true, id };
  }
  updateProduct(id, data) {
    this.run(`UPDATE products SET
      name=?,category=?,unit=?,
      buy_price=?,margin_pct=?,tva_pct=?,
      sell_price=?,sell_price_semi=?,sell_price_gros=?,sell_price_super=?,
      stock=?,stock_min=?,emplacement=?,expiry_date=?,expiry_alert=?,favorite=?,
      barcode=?,barcode2=?,barcode3=?,barcode4=?,barcode5=?,barcode6=?,barcode7=?,barcode8=?,
      image_data=?,notes=?,updated_at=datetime('now') WHERE id=?`,
      [data.name, data.category||'', data.unit||'قطعة',
       data.buy_price||0, data.margin_pct||0, data.tva_pct||0,
       data.sell_price||0, data.sell_price_semi||0,
       data.sell_price_gros||0, data.sell_price_super||0,
       data.stock||0, data.stock_min||5,
       data.emplacement||'', data.expiry_date||'', data.expiry_alert||0,
       data.favorite||0,
       data.barcode||'', data.barcode2||'', data.barcode3||'',
       data.barcode4||'', data.barcode5||'', data.barcode6||'',
       data.barcode7||'', data.barcode8||'',
       data.image_data||'', data.notes||'', id]);
    return { success:true };
  }
  deleteProduct(id) {
    this.run(`UPDATE products SET is_deleted=1 WHERE id=?`, [id]);
    return { success:true };
  }
  searchProducts(q) {
    const like = `%${q}%`;
    return this.all(`SELECT * FROM products WHERE is_deleted=0
      AND (name LIKE ? OR ref LIKE ? OR barcode LIKE ?
           OR barcode2 LIKE ? OR barcode3 LIKE ?
           OR category LIKE ? OR emplacement LIKE ?) ORDER BY name`,
      [like,like,like,like,like,like,like]);
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

  updateFournisseur(id, data) {
    this.run(`UPDATE fournisseurs SET name=?,phone=?,address=?,notes=? WHERE id=?`,
      [data.name, data.phone||'', data.address||'', data.notes||'', id]);
    return { success: true };
  }
  deleteFournisseur(id) {
    this.run(`UPDATE fournisseurs SET is_deleted=1 WHERE id=?`, [id]);
    return { success: true };
  }
  renameCategory(oldName, newName) {
    this.run(`UPDATE products SET category=? WHERE category=?`, [newName, oldName]);
    return { success: true };
  }
  deleteCategory(name) {
    this.run(`UPDATE products SET category='' WHERE category=?`, [name]);
    return { success: true };
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
    const achats = this.all(`SELECT * FROM achats WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 200`);
    return achats.map(a => ({
      ...a,
      items: this.all(`SELECT * FROM achat_items WHERE achat_id=?`, [a.id])
    }));
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
      supplier_debts: this.get(`SELECT COALESCE(SUM(reste),0) as s FROM achats WHERE is_deleted=0 AND reste>0`)?.s||0,
    };
  }

  getReports(period='month') {
    const now = new Date();
    let f = '';
    if (period==='today')      f = `AND date='${now.toISOString().slice(0,10)}'`;
    else if (period==='month') f = `AND date LIKE '${now.toISOString().slice(0,7)}%'`;
    else if (period==='year')  f = `AND date LIKE '${now.getFullYear()}%'`;

    let totalAchats = 0;
    try {
      totalAchats = this.get(`SELECT COALESCE(SUM(total),0) as s FROM achats WHERE is_deleted=0 ${f}`)?.s || 0;
    } catch(e) { totalAchats = 0; }

    let ventesByDay = [];
    try {
      ventesByDay = this.all(`SELECT date, COUNT(*) as count, COALESCE(SUM(net),0) as total
        FROM ventes WHERE is_deleted=0 ${f}
        GROUP BY date ORDER BY date ASC LIMIT 30`);
    } catch(e) { ventesByDay = []; }

    let topProducts = [];
    try {
      topProducts = this.all(`SELECT vi.product_name, SUM(vi.qty) as total_qty, SUM(vi.total) as total_amount
        FROM vente_items vi JOIN ventes v ON v.id=vi.vente_id WHERE v.is_deleted=0 ${f.replace('date','v.date')}
        GROUP BY vi.product_name ORDER BY total_qty DESC LIMIT 10`);
    } catch(e) { topProducts = []; }

    let paymentTypes = [];
    try {
      paymentTypes = this.all(`SELECT payment_type, COUNT(*) as count, COALESCE(SUM(net),0) as total
        FROM ventes WHERE is_deleted=0 ${f} GROUP BY payment_type`);
    } catch(e) { paymentTypes = []; }

    return {
      total_ventes:  this.get(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 ${f}`)?.s || 0,
      total_achats:  totalAchats,
      ventes_by_day: ventesByDay,
      top_products:  topProducts,
      payment_types: paymentTypes,
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

  // ===== QUOTES =====
  getAllQuotes() { return this.all(`SELECT * FROM quotes WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 200`); }
  getQuoteById(id) {
    const q = this.get(`SELECT * FROM quotes WHERE id=?`,[id]);
    if(!q) return null;
    q.items = this.all(`SELECT * FROM quote_items WHERE quote_id=?`,[id]);
    return q;
  }
  addQuote(data) {
    const id = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='quote_num_counter'`)?.value||'1');
    const prefix = this.get(`SELECT value FROM settings WHERE key='quote_num_prefix'`)?.value||'D';
    const num = `${prefix}${String(counter).padStart(5,'0')}`;
    this.db.run(`INSERT INTO quotes(id,num,client_id,client_name,total,discount,tva,net,status,notes,validity_days,date)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,num,data.client_id||null,data.client_name||'',data.total||0,data.discount||0,
       data.tva||0,data.net||0,data.status||'معلق',data.notes||'',data.validity_days||30,data.date]);
    (data.items||[]).forEach(item=>{
      this.db.run(`INSERT INTO quote_items(id,quote_id,product_id,product_name,ref,qty,price,total) VALUES(?,?,?,?,?,?,?,?)`,
        [this.uuid(),id,item.product_id||null,item.product_name,item.ref||'',item.qty,item.price,item.qty*item.price]);
    });
    this.db.run(`UPDATE settings SET value=? WHERE key='quote_num_counter'`,[String(counter+1)]);
    this.save();
    return {success:true,id,num};
  }
  updateQuoteStatus(id, status) {
    this.run(`UPDATE quotes SET status=? WHERE id=?`,[status,id]);
    return {success:true};
  }
  deleteQuote(id) { this.run(`UPDATE quotes SET is_deleted=1 WHERE id=?`,[id]); return {success:true}; }

  // ===== CAISSE =====
  getCaisseStats() {
    const today = new Date().toISOString().slice(0,10);
    const month = today.slice(0,7);
    return {
      total_in:    this.get(`SELECT COALESCE(SUM(montant),0) as s FROM caisse WHERE type='entrée'`)?.s||0,
      total_out:   this.get(`SELECT COALESCE(SUM(montant),0) as s FROM caisse WHERE type='sortie'`)?.s||0,
      today_in:    this.get(`SELECT COALESCE(SUM(montant),0) as s FROM caisse WHERE type='entrée' AND date=?`,[today])?.s||0,
      today_out:   this.get(`SELECT COALESCE(SUM(montant),0) as s FROM caisse WHERE type='sortie' AND date=?`,[today])?.s||0,
      month_in:    this.get(`SELECT COALESCE(SUM(montant),0) as s FROM caisse WHERE type='entrée' AND date LIKE ?`,[`${month}%`])?.s||0,
      transactions: this.all(`SELECT * FROM caisse ORDER BY created_at DESC LIMIT 100`),
    };
  }
  addCaisseTransaction(data) {
    const id = this.uuid();
    this.run(`INSERT INTO caisse(id,type,montant,description,ref_id,ref_type,date) VALUES(?,?,?,?,?,?,?)`,
      [id,data.type,data.montant,data.description||'',data.ref_id||'',data.ref_type||'',data.date||new Date().toISOString().slice(0,10)]);
    return {success:true,id};
  }

  // ===== RETOURS =====
  getAllRetours() { return this.all(`SELECT * FROM retours WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 200`); }
  addRetour(data) {
    const id = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='retour_num_counter'`)?.value||'1');
    const prefix = this.get(`SELECT value FROM settings WHERE key='retour_num_prefix'`)?.value||'R';
    const num = `${prefix}${String(counter).padStart(5,'0')}`;
    this.db.run(`INSERT INTO retours(id,num,vente_id,client_name,total,notes,date) VALUES(?,?,?,?,?,?,?)`,
      [id,num,data.vente_id||null,data.client_name||'',data.total||0,data.notes||'',data.date||new Date().toISOString().slice(0,10)]);
    (data.items||[]).forEach(item=>{
      this.db.run(`INSERT INTO retour_items(id,retour_id,product_id,product_name,qty,price,total) VALUES(?,?,?,?,?,?,?)`,
        [this.uuid(),id,item.product_id||null,item.product_name,item.qty,item.price,item.qty*item.price]);
      if(item.product_id) this.db.run(`UPDATE products SET stock=stock+? WHERE id=?`,[item.qty,item.product_id]);
    });
    this.db.run(`UPDATE settings SET value=? WHERE key='retour_num_counter'`,[String(counter+1)]);
    this.save();
    return {success:true,id,num};
  }

  // ===== DETTES =====
  getAllDettes() {
    return this.all(`SELECT v.id, v.num, v.client_name, v.net, v.paid, v.reste, v.date, v.payment_type
      FROM ventes v WHERE v.is_deleted=0 AND v.reste>0 ORDER BY v.reste DESC`);
  }
  addDebtPayment(data) {
    const id = this.uuid();
    this.db.run(`INSERT INTO debt_payments(id,vente_id,client_name,amount,notes,date) VALUES(?,?,?,?,?,?)`,
      [id,data.vente_id,data.client_name,data.amount,data.notes||'',data.date||new Date().toISOString().slice(0,10)]);
    // Update vente
    const v = this.get(`SELECT paid, net FROM ventes WHERE id=?`,[data.vente_id]);
    if(v) {
      const newPaid = parseFloat(v.paid)+parseFloat(data.amount);
      const newReste = Math.max(0, parseFloat(v.net)-newPaid);
      this.db.run(`UPDATE ventes SET paid=?, reste=? WHERE id=?`,[newPaid,newReste,data.vente_id]);
    }
    this.save();
    return {success:true,id};
  }

  // ===== LOYALTY =====
  getAllLoyalty() { return this.all(`SELECT * FROM loyalty ORDER BY points DESC`); }
  addLoyaltyPoints(clientId, clientName, points, spent) {
    const existing = this.get(`SELECT * FROM loyalty WHERE client_id=?`,[clientId]);
    if(existing) {
      const newPoints = existing.points + points;
      const newSpent = existing.total_spent + spent;
      const level = newSpent >= 500000 ? 'ذهبي' : newSpent >= 100000 ? 'فضي' : 'عادي';
      this.run(`UPDATE loyalty SET points=?,total_spent=?,level=?,client_name=?,updated_at=datetime('now') WHERE client_id=?`,
        [newPoints,newSpent,level,clientName,clientId]);
    } else {
      const level = spent >= 500000 ? 'ذهبي' : spent >= 100000 ? 'فضي' : 'عادي';
      this.run(`INSERT INTO loyalty(id,client_id,client_name,points,total_spent,level) VALUES(?,?,?,?,?,?)`,
        [this.uuid(),clientId,clientName,points,spent,level]);
    }
    return {success:true};
  }

  // ===== EXPIRY =====
  getAllExpiry() { return this.all(`SELECT * FROM expiry ORDER BY expiry_date ASC`); }
  addExpiry(data) {
    const id = this.uuid();
    this.run(`INSERT INTO expiry(id,product_id,product_name,batch_num,qty,expiry_date,notes) VALUES(?,?,?,?,?,?,?)`,
      [id,data.product_id||null,data.product_name,data.batch_num||'',data.qty||0,data.expiry_date,data.notes||'']);
    return {success:true,id};
  }
  deleteExpiry(id) { this.run(`DELETE FROM expiry WHERE id=?`,[id]); return {success:true}; }

  // ===== BRANCHES =====
  getAllBranches() { return this.all(`SELECT * FROM branches ORDER BY created_at`); }
  addBranch(data) {
    const id = this.uuid();
    this.run(`INSERT INTO branches(id,name,address,phone,manager) VALUES(?,?,?,?,?)`,
      [id,data.name,data.address||'',data.phone||'',data.manager||'']);
    return {success:true,id};
  }
  updateBranch(id,data) {
    this.run(`UPDATE branches SET name=?,address=?,phone=?,manager=?,is_active=? WHERE id=?`,
      [data.name,data.address||'',data.phone||'',data.manager||'',data.is_active??1,id]);
    return {success:true};
  }
  deleteBranch(id) { this.run(`DELETE FROM branches WHERE id=?`,[id]); return {success:true}; }

  // ===== USERS =====
  getAllUsers() { return this.all(`SELECT id,username,name,role,is_active,last_login,created_at FROM users`); }
  addUser(data) {
    const id = this.uuid();
    try {
      this.run(`INSERT INTO users(id,username,name,role,password,is_active) VALUES(?,?,?,?,?,?)`,
        [id,data.username,data.name,data.role||'cashier',data.password||'1234',1]);
      return {success:true,id};
    } catch(e) { return {success:false,error:'اسم المستخدم موجود مسبقاً'}; }
  }
  updateUser(id,data) {
    this.run(`UPDATE users SET name=?,role=?,is_active=? WHERE id=?`,
      [data.name,data.role||'cashier',data.is_active??1,id]);
    if(data.password) this.run(`UPDATE users SET password=? WHERE id=?`,[data.password,id]);
    return {success:true};
  }
  deleteUser(id) { this.run(`DELETE FROM users WHERE id!=? AND id=?`,['user-admin',id]); return {success:true}; }


  // ===== RESET ADMIN =====
  resetAdmin() {
    try {
      // Delete and re-insert admin user
      this.db.run(`DELETE FROM users WHERE id='user-admin'`);
      this.db.run(`INSERT INTO users(id,username,name,role,password,is_active) VALUES(?,?,?,?,?,?)`,
        ['user-admin','admin','مدير النظام','admin','admin123',1]);
      this.save();
      return { success: true };
    } catch(e) {
      console.error('resetAdmin error:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ===== NOTIFICATIONS =====
  getNotifications() {
    return this.all(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50`);
  }
  getUnreadCount() {
    return this.get(`SELECT COUNT(*) as c FROM notifications WHERE is_read=0`)?.c || 0;
  }
  addNotification(type, title, message, refScreen='', refId='') {
    const id = this.uuid();
    this.run(`INSERT INTO notifications(id,type,title,message,ref_screen,ref_id) VALUES(?,?,?,?,?,?)`,
      [id, type, title, message, refScreen, refId]);
    return { success: true, id };
  }
  markAllRead() {
    this.run(`UPDATE notifications SET is_read=1`);
    return { success: true };
  }
  clearNotifications() {
    this.run(`DELETE FROM notifications`);
    return { success: true };
  }
  // Generate smart notifications
  generateNotifications() {
    // Clear old auto notifications
    this.db.run(`DELETE FROM notifications WHERE type IN ('stock','debt','info')`);
    // Low stock
    const lowStock = this.all(`SELECT * FROM products WHERE is_deleted=0 AND stock<=stock_min AND stock>0 LIMIT 10`);
    lowStock.forEach(p => {
      this.db.run(`INSERT INTO notifications(id,type,title,message,ref_screen,ref_id) VALUES(?,?,?,?,?,?)`,
        [this.uuid(),'stock',`مخزون منخفض: ${p.name}`,`المخزون: ${p.stock} / الحد: ${p.stock_min}`,'products',p.id]);
    });
    // Out of stock
    const outStock = this.all(`SELECT * FROM products WHERE is_deleted=0 AND stock=0 LIMIT 10`);
    outStock.forEach(p => {
      this.db.run(`INSERT INTO notifications(id,type,title,message,ref_screen,ref_id) VALUES(?,?,?,?,?,?)`,
        [this.uuid(),'stock',`نفد المخزون: ${p.name}`,`المنتج غير متوفر`,'products',p.id]);
    });
    // Unpaid debts
    const dettes = this.all(`SELECT * FROM ventes WHERE is_deleted=0 AND reste>0 ORDER BY reste DESC LIMIT 5`);
    if (dettes.length > 0) {
      const total = dettes.reduce((s,d) => s + d.reste, 0);
      this.db.run(`INSERT INTO notifications(id,type,title,message,ref_screen,ref_id) VALUES(?,?,?,?,?,?)`,
        [this.uuid(),'debt',`${dettes.length} فواتير غير مسددة`,`إجمالي الديون: ${total.toLocaleString()} DA`,'dettes','']);
    }
    // Expiry warnings
    const soon = this.all(`SELECT * FROM expiry WHERE date(expiry_date) <= date('now','+30 days') AND date(expiry_date) >= date('now') LIMIT 5`);
    soon.forEach(e => {
      this.db.run(`INSERT INTO notifications(id,type,title,message,ref_screen,ref_id) VALUES(?,?,?,?,?,?)`,
        [this.uuid(),'info',`قرب انتهاء صلاحية: ${e.product_name}`,`تاريخ الانتهاء: ${e.expiry_date}`,'expiry',e.id]);
    });
    this.save();
    return { success: true, count: lowStock.length + outStock.length + (dettes.length>0?1:0) + soon.length };
  }
  // LOGIN
  loginUser(username, password) {
    const user = this.get(`SELECT * FROM users WHERE username=? AND password=? AND is_active=1`,[username,password]);
    if (!user) return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    this.db.run(`UPDATE users SET last_login=datetime('now') WHERE id=?`,[user.id]);
    this.save();
    return { success: true, user: { id:user.id, name:user.name, username:user.username, role:user.role } };
  }
}

module.exports = DB;
