const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const crypto = require('crypto');

const _SALT = 'DZVS_2025_#!@SEC';
function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain + _SALT).digest('hex');
}
function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.length < 60 && stored === plain) return true; // كلمات مرور قديمة
  return hashPassword(plain) === stored;
}

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
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch(e) {
      console.error('[DB] save error:', e.message);
    }
  }

  // Debounced save — writes to disk max once per 300ms
  scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.save();
      this._saveTimer = null;
    }, 300);
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.scheduleSave();
  }

  // Force immediate save (for critical ops: backup, close)
  saveNow() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
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
    // أمان وأداء قاعدة البيانات
    this.db.run("PRAGMA journal_mode=WAL");
    this.db.run("PRAGMA foreign_keys=ON");
    this.db.run("PRAGMA synchronous=NORMAL");

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
        credit_limit REAL DEFAULT 0,
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
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '', seller_name TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS stock_log (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        product_name TEXT DEFAULT '',
        qty_before INTEGER DEFAULT 0,
        qty_change INTEGER DEFAULT 0,
        qty_after INTEGER DEFAULT 0,
        reason TEXT DEFAULT 'تصحيح',
        note TEXT DEFAULT '',
        user_name TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT '📂',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS vente_items (
        id TEXT PRIMARY KEY, vente_id TEXT, product_id TEXT,
        product_name TEXT, ref TEXT, qty INTEGER DEFAULT 1,
        price REAL DEFAULT 0, total REAL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS achats (
        id TEXT PRIMARY KEY, num TEXT UNIQUE, fournisseur_id TEXT,
        fournisseur_name TEXT DEFAULT '', total REAL DEFAULT 0,
        paid REAL DEFAULT 0, reste REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً', notes TEXT DEFAULT '', seller_name TEXT DEFAULT '',
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
        seller_id TEXT DEFAULT '', seller_name TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS seller_sessions (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        seller_name TEXT DEFAULT '',
        opening_amount REAL DEFAULT 0,
        closing_amount REAL DEFAULT 0,
        sales_total REAL DEFAULT 0,
        sales_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        opened_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT DEFAULT '')`,
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
      `CREATE TABLE IF NOT EXISTS direct_debts (
        id TEXT PRIMARY KEY,
        num TEXT UNIQUE,
        person_name TEXT NOT NULL,
        person_phone TEXT DEFAULT '',
        amount REAL DEFAULT 0,
        paid REAL DEFAULT 0,
        reste REAL DEFAULT 0,
        type TEXT DEFAULT 'علي',
        notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS direct_debt_payments (
        id TEXT PRIMARY KEY,
        debt_id TEXT NOT NULL,
        amount REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        date TEXT DEFAULT (date('now')),
        created_at TEXT DEFAULT (datetime('now')))`,
    ];

    // Run each CREATE TABLE separately — guaranteed to work in sql.js
    tables.forEach(sql => {
      try { this.db.run(sql); } catch(e) { console.error('Table create error:', e.message); }
    });

    // Migration: add new columns to existing DBs
    // ─── Indexes للأداء ───
    ['products_name','products_barcode','products_category','ventes_date','ventes_client','vente_items_vente','stock_log_product'].forEach(function(name) {
      try {
        var tableSql = {
          products_name: 'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
          products_barcode: 'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
          products_category: 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
          ventes_date: 'CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(date)',
          ventes_client: 'CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(client_name)',
          vente_items_vente: 'CREATE INDEX IF NOT EXISTS idx_vente_items_vente ON vente_items(vente_id)',
          stock_log_product: 'CREATE INDEX IF NOT EXISTS idx_stock_log_product ON stock_log(product_id)',
        };
        this.db.run(tableSql[name]);
      } catch(e) {}
    }, this);

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
      `ALTER TABLE clients ADD COLUMN credit_limit REAL DEFAULT 0`,
      `CREATE TABLE IF NOT EXISTS variant_types (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS variant_values (id TEXT PRIMARY KEY, type_id TEXT NOT NULL, value TEXT NOT NULL, sort_order INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS product_variants (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, attr1_name TEXT DEFAULT '', attr1_val TEXT DEFAULT '', attr2_name TEXT DEFAULT '', attr2_val TEXT DEFAULT '', barcode TEXT DEFAULT '', stock INTEGER DEFAULT 0, stock_min INTEGER DEFAULT 0, price_override REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS direct_debts (id TEXT PRIMARY KEY, num TEXT UNIQUE, person_name TEXT NOT NULL, person_phone TEXT DEFAULT '', amount REAL DEFAULT 0, paid REAL DEFAULT 0, reste REAL DEFAULT 0, type TEXT DEFAULT 'علي', notes TEXT DEFAULT '', date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')), is_deleted INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS direct_debt_payments (id TEXT PRIMARY KEY, debt_id TEXT NOT NULL, amount REAL DEFAULT 0, notes TEXT DEFAULT '', date TEXT DEFAULT (date('now')), created_at TEXT DEFAULT (datetime('now')))`,
      `ALTER TABLE caisse ADD COLUMN seller_id TEXT DEFAULT ''`,
      `ALTER TABLE caisse ADD COLUMN seller_name TEXT DEFAULT ''`,
      `ALTER TABLE ventes ADD COLUMN seller_name TEXT DEFAULT ''`,
      `ALTER TABLE ventes ADD COLUMN notes TEXT DEFAULT ''`,
    ];
    migrations.forEach(sql => {
      try { this.db.run(sql); } catch(e) {} // ignore "duplicate column" errors
    });

    // Settings defaults
    const defaults = [
      ['company_name','محل الأغواط للإلكترونيات'],['company_phone','0550 000 000'],
      ['company_address','الأغواط، الجزائر'],['tva','19'],['currency','DA'],
      ['company_nif',''],['company_nis',''],['company_rc',''],['company_ai',''],
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
    // لا نجلب image_data هنا — تجلب عند الطلب فقط
    return this.all(`SELECT id,ref,name,category,unit,buy_price,margin_pct,tva_pct,
      sell_price,sell_price_semi,sell_price_gros,stock,stock_min,emplacement,
      expiry_date,expiry_alert,favorite,barcode,barcode2,barcode3,
      notes,updated_at FROM products WHERE is_deleted=0 ORDER BY name`);
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
    if (!data.name || !data.name.trim()) return { success:false, error:'اسم المنتج مطلوب' };
    if (data.buy_price < 0 || data.sell_price < 0) return { success:false, error:'الأسعار لا يمكن أن تكون سالبة' };
    if (data.stock < 0) return { success:false, error:'المخزون لا يمكن أن يكون سالباً' };
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
  getProductImage(id) {
    const row = this.get(`SELECT image_data FROM products WHERE id=?`,[id]);
    return row?.image_data || '';
  }

  getProductById(id) {
    return this.get(`SELECT * FROM products WHERE id=? AND is_deleted=0`,[id]);
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
    this.run(`UPDATE clients SET name=?,phone=?,address=?,notes=?,credit_limit=? WHERE id=?`,
      [data.name,data.phone||'',data.address||'',data.notes||'',data.credit_limit||0,id]);
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
  addStockLog(data) {
    const id = this.uuid();
    this.db.run(
      `INSERT INTO stock_log(id,product_id,product_name,qty_before,qty_change,qty_after,reason,note,user_name)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [id, data.product_id, data.product_name||'', data.qty_before||0,
       data.qty_change||0, data.qty_after||0, data.reason||'تصحيح',
       data.note||'', data.user_name||'']
    );
    this.save();
    return { success:true };
  }

  getStockLog(productId) {
    if (productId) {
      return this.all(
        `SELECT * FROM stock_log WHERE product_id=? ORDER BY created_at DESC LIMIT 50`,
        [productId]
      );
    }
    return this.all(`SELECT * FROM stock_log ORDER BY created_at DESC LIMIT 500`);
  }

  updateProductStock(id, qtyChange, reason, note, userName) {
    const p = this.get(`SELECT stock, name FROM products WHERE id=?`, [id]);
    if (!p) return { success:false, error:'منتج غير موجود' };
    const qtyBefore = p.stock || 0;
    const qtyAfter  = Math.max(0, qtyBefore + qtyChange);
    this.db.run(`UPDATE products SET stock=?, updated_at=datetime('now') WHERE id=?`, [qtyAfter, id]);
    this.addStockLog({ product_id:id, product_name:p.name, qty_before:qtyBefore,
      qty_change:qtyChange, qty_after:qtyAfter, reason, note, user_name:userName||'' });
    this.saveNow();
    return { success:true, qty_before:qtyBefore, qty_after:qtyAfter };
  }

  addCategory(name, color='#6366f1', icon='📂') {
    try {
      const id = this.uuid();
      this.db.run(`INSERT OR IGNORE INTO categories(id,name,color,icon) VALUES(?,?,?,?)`,
        [id, name.trim(), color, icon]);
      this.save();
      return { success: true };
    } catch(e) { return { success: false, error: e.message }; }
  }

  getAllCategories() {
    const cats = this.all(`SELECT * FROM categories ORDER BY sort_order,name`);
    // ادمج مع الفئات الموجودة في المنتجات
    const fromProducts = this.all(
      `SELECT DISTINCT category as name FROM products WHERE is_deleted=0 AND category!='' AND category IS NOT NULL`
    );
    const defined = new Set(cats.map(c=>c.name));
    fromProducts.forEach(r => {
      if (!defined.has(r.name)) {
        cats.push({ id: null, name: r.name, color: '#6366f1', icon: '📂' });
      }
    });
    return cats;
  }

  updateCategoryMeta(name, color, icon) {
    const existing = this.get(`SELECT id FROM categories WHERE name=?`, [name]);
    if (existing) {
      this.db.run(`UPDATE categories SET color=?,icon=? WHERE name=?`, [color, icon, name]);
    } else {
      const id = this.uuid();
      this.db.run(`INSERT OR IGNORE INTO categories(id,name,color,icon) VALUES(?,?,?,?)`,
        [id, name, color, icon]);
    }
    this.save();
    return { success: true };
  }

  renameCategory(oldName, newName) {
    this.run(`UPDATE products SET category=? WHERE category=?`, [newName, oldName]);
    // تحديث جدول categories أيضاً
    try {
      this.db.run(`UPDATE categories SET name=? WHERE name=?`, [newName, oldName]);
    } catch(e) {}
    this.save();
    return { success: true };
  }
  deleteCategory(name) {
    this.run(`UPDATE products SET category='' WHERE category=?`, [name]);
    // حذف من جدول categories أيضاً
    try { this.db.run(`DELETE FROM categories WHERE name=?`, [name]); } catch(e) {}
    this.save();
    return { success: true };
  }

  // ===== VENTES =====
  getAllVentes() {
    return this.all(`SELECT v.*, vi_sum.items FROM ventes v
      LEFT JOIN (SELECT vente_id, group_concat(product_name||' x'||qty,', ') as items
        FROM vente_items GROUP BY vente_id) vi_sum ON v.id=vi_sum.vente_id
      WHERE v.is_deleted=0 ORDER BY v.created_at DESC LIMIT 500`);
  }
  deleteVente(id) {
    // جلب السلع لإرجاع الكميات
    const items = this.all(`SELECT * FROM vente_items WHERE vente_id=?`,[id]);
    items.forEach(item => {
      if (item.product_id) {
        this.db.run(`UPDATE products SET stock=stock+? WHERE id=?`,[item.qty,item.product_id]);
      }
    });
    this.db.run(`UPDATE ventes SET is_deleted=1 WHERE id=?`,[id]);
    this.saveNow();
    return { success:true };
  }

  updateVenteNotes(id, notes) {
    this.db.run(`UPDATE ventes SET notes=? WHERE id=?`, [notes||'', id]);
    this.saveNow();
    return { success: true };
  }

  getVenteById(id) {
    const v = this.get(`SELECT * FROM ventes WHERE id=?`,[id]);
    if (!v) return null;
    v.items = this.all(`SELECT * FROM vente_items WHERE vente_id=?`,[id]);
    return v;
  }
  addVente(data) {
    // Validation
    if (!data.items || data.items.length === 0) return { success:false, error:'لا توجد سلع في الفاتورة' };
    if (data.net < 0) return { success:false, error:'المبلغ لا يمكن أن يكون سالباً' };
    // تحقق من سقف الكريدي
    if (data.client_id && data.reste > 0) {
      const client = this.get(`SELECT balance, credit_limit FROM clients WHERE id=?`,[data.client_id]);
      if (client && client.credit_limit > 0) {
        const newBalance = (client.balance||0) + data.reste;
        if (newBalance > client.credit_limit) {
          return { success:false, error:`تجاوز سقف الكريدي! الرصيد الحالي: ${client.balance} DA، السقف: ${client.credit_limit} DA` };
        }
      }
    }

    const id = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='vente_num_counter'`)?.value || '1');
    const prefix = this.get(`SELECT value FROM settings WHERE key='vente_num_prefix'`)?.value || 'F';
    const num = `${prefix}${String(counter).padStart(5,'0')}`;

    // Transaction — إما كل شيء أو لا شيء
    try {
      this.db.run('BEGIN TRANSACTION');

      this.db.run(`INSERT INTO ventes(id,num,client_id,client_name,total,discount,tva,net,paid,reste,payment_type,notes,seller_name,date)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,num,data.client_id||null,data.client_name,data.total||0,data.discount||0,
         data.tva||0,data.net||0,data.paid||0,data.reste||0,data.payment_type,data.notes||'',data.seller_name||'',data.date]);

      (data.items||[]).forEach(item => {
        if (item.qty <= 0) throw new Error('الكمية يجب أن تكون موجبة');
        this.db.run(`INSERT INTO vente_items(id,vente_id,product_id,product_name,ref,qty,price,total)
          VALUES(?,?,?,?,?,?,?,?)`,
          [this.uuid(),id,item.product_id||null,item.product_name,item.ref||'',
           item.qty,item.price,item.qty*item.price]);
        if (item.product_id) {
          const before = this.get(`SELECT stock,name FROM products WHERE id=?`,[item.product_id]);
          this.db.run(`UPDATE products SET stock=stock-?,updated_at=datetime('now') WHERE id=?`,[item.qty,item.product_id]);
          if (before) {
            this.addStockLog({ product_id:item.product_id, product_name:before.name,
              qty_before:before.stock||0, qty_change:-item.qty,
              qty_after:Math.max(0,(before.stock||0)-item.qty),
              reason:'بيع', note:'فاتورة '+num, user_name:data.seller_name||'' });
          }
        }
      });

      // counter atomic update داخل نفس الـ transaction
      this.db.run(`UPDATE settings SET value=? WHERE key='vente_num_counter'`,[String(counter+1)]);

      this.db.run('COMMIT');
      this.saveNow();
      return { success:true, id, num };
    } catch(e) {
      try { this.db.run('ROLLBACK'); } catch(_) {}
      return { success:false, error: e.message };
    }
  }

  // ===== ACHATS =====
  getAllAchats() {
    const achats = this.all(`SELECT * FROM achats WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 500`);
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

    try {
      this.db.run('BEGIN TRANSACTION');

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
        const before2 = this.get(`SELECT stock,name FROM products WHERE id=?`,[item.product_id]);
        this.db.run(`UPDATE products SET stock=stock+?,buy_price=?,updated_at=datetime('now') WHERE id=?`,
          [item.qty,item.price,item.product_id]);
        if (before2) {
          this.addStockLog({ product_id:item.product_id, product_name:before2.name,
            qty_before:before2.stock||0, qty_change:item.qty,
            qty_after:(before2.stock||0)+item.qty,
            reason:'شراء', note:'فاتورة '+num, user_name:'' });
        }
      }
    });
      this.db.run(`UPDATE settings SET value=? WHERE key='achat_num_counter'`,[String(counter+1)]);
      this.db.run('COMMIT');
      this.saveNow();
      return { success:true, id, num };
    } catch(e) {
      try { this.db.run('ROLLBACK'); } catch(_) {}
      return { success:false, error: e.message };
    }
  }

  updateAchat(id, data) {
    if (data.paid !== undefined) {
      this.db.run(`UPDATE achats SET paid=?, reste=? WHERE id=?`,
        [data.paid, data.reste, id]);
    }
    this.saveNow();
    return { success: true };
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
    this.saveNow();
    return { success:true };
  }

  // ===== QUOTES =====
  getAllQuotes() { return this.all(`SELECT * FROM quotes WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 500`); }
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
    this.saveNow();
    return {success:true,id,num};
  }
  updateQuoteStatus(id, status) {
    this.run(`UPDATE quotes SET status=? WHERE id=?`,[status,id]);
    return {success:true};
  }
  deleteQuote(id) { this.run(`UPDATE quotes SET is_deleted=1 WHERE id=?`,[id]); return {success:true}; }

  // ===== CAISSE =====
  // ─── Seller Sessions ───
  openSellerSession(sellerId, sellerName, openingAmount) {
    // إغلاق أي جلسة مفتوحة لنفس البائع
    const existing = this.get(
      `SELECT id FROM seller_sessions WHERE seller_id=? AND status='open'`, [sellerId]
    );
    if (existing) {
      this.db.run(`UPDATE seller_sessions SET status='closed',closed_at=datetime('now') WHERE id=?`,
        [existing.id]);
    }
    const id = this.uuid();
    this.db.run(
      `INSERT INTO seller_sessions(id,seller_id,seller_name,opening_amount,status) VALUES(?,?,?,?,'open')`,
      [id, sellerId, sellerName, openingAmount||0]
    );
    this.save();
    return { success:true, session_id:id };
  }

  closeSellerSession(sessionId, closingAmount) {
    const s = this.get(`SELECT * FROM seller_sessions WHERE id=?`, [sessionId]);
    if (!s) return { success:false, error:'الجلسة غير موجودة' };
    // احسب إجمالي المبيعات خلال الجلسة
    const sales = this.get(
      `SELECT COALESCE(SUM(net),0) as total, COUNT(*) as cnt FROM ventes
       WHERE seller_name=? AND created_at>=? AND is_deleted=0`,
      [s.seller_name, s.opened_at]
    );
    this.db.run(
      `UPDATE seller_sessions SET status='closed',closed_at=datetime('now'),
       closing_amount=?,sales_total=?,sales_count=? WHERE id=?`,
      [closingAmount||0, sales?.total||0, sales?.cnt||0, sessionId]
    );
    this.save();
    return {
      success:true,
      diff: (closingAmount||0) - (s.opening_amount||0) - (sales?.total||0),
      sales_total: sales?.total||0,
      sales_count: sales?.cnt||0,
    };
  }

  getSellerSession(sellerId) {
    return this.get(
      `SELECT * FROM seller_sessions WHERE seller_id=? AND status='open'`, [sellerId]
    );
  }

  getAllSellerSessions(date) {
    const d = date || new Date().toISOString().slice(0,10);
    return this.all(
      `SELECT * FROM seller_sessions WHERE date(opened_at)=? ORDER BY opened_at DESC`, [d]
    );
  }

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
  getAllRetours() { return this.all(`SELECT * FROM retours WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 500`); }
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
    return this.all(`SELECT v.id, v.num, v.client_id, v.client_name, v.net, v.paid, v.reste, v.date, v.payment_type
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

  // ===== PRODUCT VARIANTS =====
  // ─── أنواع المتغيرات (مثل الوحدات) ───
  getAllVariantTypes() {
    const types = this.all(`SELECT * FROM variant_types ORDER BY sort_order, name`);
    return types.map(t => ({
      ...t,
      values: this.all(`SELECT * FROM variant_values WHERE type_id=? ORDER BY sort_order, value`, [t.id])
    }));
  }

  addVariantType(name) {
    if (!name?.trim()) return { success:false, error:'الاسم مطلوب' };
    const existing = this.get(`SELECT id FROM variant_types WHERE name=?`,[name.trim()]);
    if (existing) return { success:false, error:'هذا النوع موجود مسبقاً' };
    const id = this.uuid();
    this.db.run(`INSERT INTO variant_types(id,name) VALUES(?,?)`,[id, name.trim()]);
    this.save();
    return { success:true, id };
  }

  deleteVariantType(id) {
    this.db.run(`DELETE FROM variant_values WHERE type_id=?`,[id]);
    this.db.run(`DELETE FROM variant_types WHERE id=?`,[id]);
    this.save();
    return { success:true };
  }

  addVariantValue(typeId, value) {
    if (!value?.trim()) return { success:false, error:'القيمة مطلوبة' };
    const id = this.uuid();
    this.db.run(`INSERT INTO variant_values(id,type_id,value) VALUES(?,?,?)`,[id, typeId, value.trim()]);
    this.save();
    return { success:true, id };
  }

  deleteVariantValue(id) {
    this.db.run(`DELETE FROM variant_values WHERE id=?`,[id]);
    this.save();
    return { success:true };
  }

  getVariants(productId) {
    return this.all(
      `SELECT * FROM product_variants WHERE product_id=? ORDER BY attr1_val, attr2_val`,
      [productId]
    );
  }

  getAllVariants() {
    return this.all(`SELECT pv.*, p.name as product_name, p.sell_price as base_price
      FROM product_variants pv
      JOIN products p ON p.id=pv.product_id
      WHERE p.is_deleted=0
      ORDER BY p.name, pv.attr1_val, pv.attr2_val`);
  }

  addVariant(data) {
    if (!data.product_id) return { success:false, error:'product_id مطلوب' };
    const id = this.uuid();
    this.db.run(
      `INSERT INTO product_variants(id,product_id,attr1_name,attr1_val,attr2_name,attr2_val,barcode,stock,stock_min,price_override)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [id, data.product_id,
       data.attr1_name||'', data.attr1_val||'',
       data.attr2_name||'', data.attr2_val||'',
       data.barcode||'', parseInt(data.stock)||0,
       parseInt(data.stock_min)||0,
       parseFloat(data.price_override)||0]
    );
    this.save();
    return { success:true, id };
  }

  updateVariant(id, data) {
    this.db.run(
      `UPDATE product_variants SET
        attr1_name=?, attr1_val=?, attr2_name=?, attr2_val=?,
        barcode=?, stock=?, stock_min=?, price_override=?,
        updated_at=datetime('now')
       WHERE id=?`,
      [data.attr1_name||'', data.attr1_val||'',
       data.attr2_name||'', data.attr2_val||'',
       data.barcode||'', parseInt(data.stock)||0,
       parseInt(data.stock_min)||0,
       parseFloat(data.price_override)||0, id]
    );
    this.save();
    return { success:true };
  }

  deleteVariant(id) {
    this.db.run(`DELETE FROM product_variants WHERE id=?`,[id]);
    this.save();
    return { success:true };
  }

  updateVariantStock(id, change, reason, note, userName) {
    const v = this.get(`SELECT pv.*, p.name as pname FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=?`,[id]);
    if (!v) return { success:false };
    const before = v.stock||0;
    const after  = Math.max(0, before+change);
    this.db.run(`UPDATE product_variants SET stock=?,updated_at=datetime('now') WHERE id=?`,[after,id]);
    this.addStockLog({ product_id:v.product_id, product_name:v.pname+' ('+v.attr1_val+(v.attr2_val?' / '+v.attr2_val:'')+')',
      qty_before:before, qty_change:change, qty_after:after, reason, note, user_name:userName||'' });
    this.save();
    return { success:true, qty_before:before, qty_after:after };
  }

  // البحث بباركود المتغير في POS
  findVariantByBarcode(barcode) {
    return this.get(
      `SELECT pv.*, p.name as product_name, p.sell_price, p.buy_price,
              p.unit, p.favorite, p.category, p.ref, p.image_data
       FROM product_variants pv
       JOIN products p ON p.id=pv.product_id
       WHERE pv.barcode=? AND p.is_deleted=0`,
      [barcode]
    );
  }

  // ===== DIRECT DEBTS (دفتر الديون المباشرة) =====
  getAllDirectDebts() {
    return this.all(`SELECT * FROM direct_debts WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 500`);
  }

  addDirectDebt(data) {
    if (!data.person_name?.trim()) return { success:false, error:'اسم الشخص مطلوب' };
    if (!data.amount || data.amount <= 0) return { success:false, error:'المبلغ يجب أن يكون موجباً' };
    const id  = this.uuid();
    const counter = parseInt(this.get(`SELECT value FROM settings WHERE key='direct_debt_counter'`)?.value||'1');
    const num = 'D' + String(counter).padStart(5,'0');
    try {
      this.db.run('BEGIN TRANSACTION');
      this.db.run(
        `INSERT INTO direct_debts(id,num,person_name,person_phone,amount,paid,reste,type,notes,date)
         VALUES(?,?,?,?,?,0,?,?,?,?)`,
        [id,num,data.person_name.trim(),data.person_phone||'',
         data.amount,data.amount,data.type||'علي',data.notes||'',data.date||new Date().toISOString().slice(0,10)]
      );
      this.db.run(`INSERT OR IGNORE INTO settings(key,value) VALUES('direct_debt_counter','1')`);
      this.db.run(`UPDATE settings SET value=? WHERE key='direct_debt_counter'`,[String(counter+1)]);
      this.db.run('COMMIT');
      this.save();
      return { success:true, id, num };
    } catch(e) {
      try { this.db.run('ROLLBACK'); } catch(_) {}
      return { success:false, error:e.message };
    }
  }

  addDirectDebtPayment(debtId, amount, notes, date) {
    const debt = this.get(`SELECT * FROM direct_debts WHERE id=?`,[debtId]);
    if (!debt) return { success:false, error:'الدين غير موجود' };
    if (amount <= 0) return { success:false, error:'المبلغ يجب أن يكون موجباً' };
    const actualAmount = Math.min(amount, debt.reste);
    const newPaid  = parseFloat(debt.paid) + actualAmount;
    const newReste = Math.max(0, parseFloat(debt.amount) - newPaid);
    this.db.run(
      `INSERT INTO direct_debt_payments(id,debt_id,amount,notes,date) VALUES(?,?,?,?,?)`,
      [this.uuid(), debtId, actualAmount, notes||'', date||new Date().toISOString().slice(0,10)]
    );
    this.db.run(`UPDATE direct_debts SET paid=?,reste=? WHERE id=?`,[newPaid,newReste,debtId]);
    this.save();
    return { success:true, paid:newPaid, reste:newReste };
  }

  getDirectDebtPayments(debtId) {
    return this.all(`SELECT * FROM direct_debt_payments WHERE debt_id=? ORDER BY created_at DESC`,[debtId]);
  }

  deleteDirectDebt(id) {
    this.run(`UPDATE direct_debts SET is_deleted=1 WHERE id=?`,[id]);
    return { success:true };
  }

  // ═══ سجل دفعات الديون (زبائن) ═══
  getDebtPayments(venteId) {
    if (venteId) {
      return this.all(`SELECT * FROM debt_payments WHERE vente_id=? ORDER BY created_at DESC`,[venteId]);
    }
    return this.all(`SELECT * FROM debt_payments ORDER BY created_at DESC LIMIT 200`);
  }

  // ═══ كشف حساب الزبون ═══
  getClientStatement(clientName) {
    const ventes = this.all(
      `SELECT v.*, 'vente' as type FROM ventes v WHERE v.client_name=? AND v.is_deleted=0 ORDER BY v.date DESC`,
      [clientName]
    );
    const payments = this.all(
      `SELECT dp.*, 'payment' as type FROM debt_payments dp WHERE dp.client_name=? ORDER BY dp.date DESC`,
      [clientName]
    );
    const totalBuy   = ventes.reduce((s,v)=>s+(v.net||0),0);
    const totalPaid  = ventes.reduce((s,v)=>s+(v.paid||0),0);
    const totalDebt  = ventes.reduce((s,v)=>s+(v.reste||0),0);
    return { ventes, payments, totalBuy, totalPaid, totalDebt };
  }

  // ═══ إحصائيات الديون ═══
  getDetteStats() {
    const dettes = this.getAllDettes();
    const now = new Date();
    dettes.forEach(d => {
      d.days_old = Math.floor((now - new Date(d.date))/(1000*60*60*24));
    });
    // أكثر 5 مديونين
    const byClient = {};
    dettes.forEach(d => {
      byClient[d.client_name] = (byClient[d.client_name]||0) + (d.reste||0);
    });
    const top5 = Object.entries(byClient)
      .sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([name,amount])=>({name,amount}));
    return {
      total: dettes.reduce((s,d)=>s+(d.reste||0),0),
      count: dettes.length,
      age7:   dettes.filter(d=>d.days_old<=7).length,
      age30:  dettes.filter(d=>d.days_old>7&&d.days_old<=30).length,
      age90:  dettes.filter(d=>d.days_old>30&&d.days_old<=90).length,
      age90p: dettes.filter(d=>d.days_old>90).length,
      top5,
    };
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
        [id,data.username,data.name,data.role||'cashier',hashPassword(data.password||'1234'),1]);
      return {success:true,id};
    } catch(e) { return {success:false,error:'اسم المستخدم موجود مسبقاً'}; }
  }
  updateUser(id,data) {
    this.run(`UPDATE users SET name=?,role=?,is_active=? WHERE id=?`,
      [data.name,data.role||'cashier',data.is_active??1,id]);
    if(data.password) this.run(`UPDATE users SET password=? WHERE id=?`,[hashPassword(data.password),id]);
    return {success:true};
  }
  deleteUser(id) { this.run(`DELETE FROM users WHERE id=? AND id!='user-admin'`,[id]); return {success:true}; }


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
    const user = this.get(`SELECT * FROM users WHERE username=? AND is_active=1`,[username]);
    if (!user) return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    if (!verifyPassword(password, user.password)) return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    // إذا كانت كلمة المرور قديمة (غير مشفرة) نشفرها الآن
    if (user.password.length < 60) {
      this.db.run(`UPDATE users SET password=? WHERE id=?`,[hashPassword(password),user.id]);
    }
    this.db.run(`UPDATE users SET last_login=datetime('now') WHERE id=?`,[user.id]);
    this.save();
    return { success: true, user: { id:user.id, name:user.name, username:user.username, role:user.role } };
  }
}

module.exports = DB;
