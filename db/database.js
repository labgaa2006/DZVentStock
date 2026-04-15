const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { randomUUID } = require('crypto');

class DB {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'dzventstock.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  init() {
    this.db.exec(`
      -- ===== SETTINGS =====
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      -- ===== PRODUCTS =====
      CREATE TABLE IF NOT EXISTS products (
        id          TEXT PRIMARY KEY,
        ref         TEXT UNIQUE,
        name        TEXT NOT NULL,
        category    TEXT DEFAULT '',
        unit        TEXT DEFAULT 'قطعة',
        buy_price   REAL DEFAULT 0,
        sell_price  REAL DEFAULT 0,
        stock       INTEGER DEFAULT 0,
        stock_min   INTEGER DEFAULT 5,
        barcode     TEXT DEFAULT '',
        notes       TEXT DEFAULT '',
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now')),
        is_deleted  INTEGER DEFAULT 0
      );

      -- ===== CLIENTS =====
      CREATE TABLE IF NOT EXISTS clients (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT DEFAULT '',
        address    TEXT DEFAULT '',
        notes      TEXT DEFAULT '',
        balance    REAL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0
      );

      -- ===== FOURNISSEURS =====
      CREATE TABLE IF NOT EXISTS fournisseurs (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT DEFAULT '',
        address    TEXT DEFAULT '',
        notes      TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0
      );

      -- ===== VENTES =====
      CREATE TABLE IF NOT EXISTS ventes (
        id           TEXT PRIMARY KEY,
        num          TEXT UNIQUE,
        client_id    TEXT REFERENCES clients(id),
        client_name  TEXT DEFAULT 'عميل نقدي',
        total        REAL DEFAULT 0,
        discount     REAL DEFAULT 0,
        tva          REAL DEFAULT 0,
        net          REAL DEFAULT 0,
        paid         REAL DEFAULT 0,
        reste        REAL DEFAULT 0,
        payment_type TEXT DEFAULT 'نقداً',
        notes        TEXT DEFAULT '',
        date         TEXT DEFAULT (date('now')),
        created_at   TEXT DEFAULT (datetime('now')),
        updated_at   TEXT DEFAULT (datetime('now')),
        is_deleted   INTEGER DEFAULT 0
      );

      -- ===== VENTE ITEMS =====
      CREATE TABLE IF NOT EXISTS vente_items (
        id          TEXT PRIMARY KEY,
        vente_id    TEXT REFERENCES ventes(id) ON DELETE CASCADE,
        product_id  TEXT REFERENCES products(id),
        product_name TEXT,
        ref         TEXT,
        qty         INTEGER DEFAULT 1,
        price       REAL DEFAULT 0,
        total       REAL DEFAULT 0
      );

      -- ===== ACHATS =====
      CREATE TABLE IF NOT EXISTS achats (
        id              TEXT PRIMARY KEY,
        num             TEXT UNIQUE,
        fournisseur_id  TEXT REFERENCES fournisseurs(id),
        fournisseur_name TEXT DEFAULT '',
        total           REAL DEFAULT 0,
        paid            REAL DEFAULT 0,
        reste           REAL DEFAULT 0,
        payment_type    TEXT DEFAULT 'نقداً',
        notes           TEXT DEFAULT '',
        date            TEXT DEFAULT (date('now')),
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now')),
        is_deleted      INTEGER DEFAULT 0
      );

      -- ===== ACHAT ITEMS =====
      CREATE TABLE IF NOT EXISTS achat_items (
        id          TEXT PRIMARY KEY,
        achat_id    TEXT REFERENCES achats(id) ON DELETE CASCADE,
        product_id  TEXT REFERENCES products(id),
        product_name TEXT,
        ref         TEXT,
        qty         INTEGER DEFAULT 1,
        price       REAL DEFAULT 0,
        total       REAL DEFAULT 0
      );
    `);

    // إعدادات افتراضية
    const insertSetting = this.db.prepare(
      `INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)`
    );
    const defaults = [
      ['company_name', 'محل الأغواط للإلكترونيات'],
      ['company_phone', '0550 000 000'],
      ['company_address', 'الأغواط، الجزائر'],
      ['tva', '19'],
      ['currency', 'DA'],
      ['paper_size', 'A4'],
      ['stock_alert', '1'],
      ['vente_num_prefix', 'F'],
      ['vente_num_counter', '1'],
      ['achat_num_prefix', 'A'],
      ['achat_num_counter', '1'],
    ];
    defaults.forEach(([k, v]) => insertSetting.run(k, v));
  }

  uuid() { return randomUUID(); }

  // ===========================
  // PRODUCTS
  // ===========================
  getAllProducts() {
    return this.db.prepare(
      `SELECT * FROM products WHERE is_deleted=0 ORDER BY name`
    ).all();
  }

  addProduct(data) {
    const id = this.uuid();
    // رقم مرجعي تلقائي
    if (!data.ref) {
      const count = this.db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
      data.ref = `REF-${String(count + 1).padStart(3, '0')}`;
    }
    this.db.prepare(`
      INSERT INTO products (id,ref,name,category,unit,buy_price,sell_price,stock,stock_min,barcode,notes)
      VALUES (@id,@ref,@name,@category,@unit,@buy_price,@sell_price,@stock,@stock_min,@barcode,@notes)
    `).run({ id, ref: data.ref, name: data.name, category: data.category || '',
              unit: data.unit || 'قطعة', buy_price: data.buy_price || 0,
              sell_price: data.sell_price || 0, stock: data.stock || 0,
              stock_min: data.stock_min || 5, barcode: data.barcode || '',
              notes: data.notes || '' });
    return { success: true, id };
  }

  updateProduct(id, data) {
    data.updated_at = new Date().toISOString();
    data.id = id;
    this.db.prepare(`
      UPDATE products SET name=@name,category=@category,unit=@unit,
        buy_price=@buy_price,sell_price=@sell_price,stock=@stock,
        stock_min=@stock_min,barcode=@barcode,notes=@notes,updated_at=@updated_at
      WHERE id=@id
    `).run(data);
    return { success: true };
  }

  deleteProduct(id) {
    this.db.prepare(
      `UPDATE products SET is_deleted=1, updated_at=? WHERE id=?`
    ).run(new Date().toISOString(), id);
    return { success: true };
  }

  searchProducts(q) {
    const like = `%${q}%`;
    return this.db.prepare(`
      SELECT * FROM products WHERE is_deleted=0
      AND (name LIKE ? OR ref LIKE ? OR barcode LIKE ? OR category LIKE ?)
      ORDER BY name
    `).all(like, like, like, like);
  }

  // ===========================
  // CLIENTS
  // ===========================
  getAllClients() {
    return this.db.prepare(
      `SELECT * FROM clients WHERE is_deleted=0 ORDER BY name`
    ).all();
  }

  addClient(data) {
    const id = this.uuid();
    this.db.prepare(`
      INSERT INTO clients (id,name,phone,address,notes)
      VALUES (@id,@name,@phone,@address,@notes)
    `).run({ id, name: data.name, phone: data.phone || '',
              address: data.address || '', notes: data.notes || '' });
    return { success: true, id };
  }

  updateClient(id, data) {
    this.db.prepare(`
      UPDATE clients SET name=@name,phone=@phone,address=@address,notes=@notes,updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...data, id });
    return { success: true };
  }

  deleteClient(id) {
    this.db.prepare(`UPDATE clients SET is_deleted=1 WHERE id=?`).run(id);
    return { success: true };
  }

  // ===========================
  // FOURNISSEURS
  // ===========================
  getAllFournisseurs() {
    return this.db.prepare(
      `SELECT * FROM fournisseurs WHERE is_deleted=0 ORDER BY name`
    ).all();
  }

  addFournisseur(data) {
    const id = this.uuid();
    this.db.prepare(`
      INSERT INTO fournisseurs (id,name,phone,address,notes)
      VALUES (@id,@name,@phone,@address,@notes)
    `).run({ id, name: data.name, phone: data.phone || '',
              address: data.address || '', notes: data.notes || '' });
    return { success: true, id };
  }

  // ===========================
  // VENTES
  // ===========================
  getAllVentes() {
    return this.db.prepare(`
      SELECT v.*, GROUP_CONCAT(vi.product_name || ' x' || vi.qty, ' | ') as items_summary
      FROM ventes v
      LEFT JOIN vente_items vi ON v.id = vi.vente_id
      WHERE v.is_deleted=0
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT 200
    `).all();
  }

  getVenteById(id) {
    const vente = this.db.prepare(`SELECT * FROM ventes WHERE id=?`).get(id);
    if (!vente) return null;
    vente.items = this.db.prepare(`SELECT * FROM vente_items WHERE vente_id=?`).all(id);
    return vente;
  }

  addVente(data) {
    const id = this.uuid();
    // رقم الفاتورة التلقائي
    const counter = parseInt(this.db.prepare(`SELECT value FROM settings WHERE key='vente_num_counter'`).get().value);
    const prefix = this.db.prepare(`SELECT value FROM settings WHERE key='vente_num_prefix'`).get().value;
    const num = `${prefix}${String(counter).padStart(5, '0')}`;

    const insertVente = this.db.prepare(`
      INSERT INTO ventes (id,num,client_id,client_name,total,discount,tva,net,paid,reste,payment_type,notes,date)
      VALUES (@id,@num,@client_id,@client_name,@total,@discount,@tva,@net,@paid,@reste,@payment_type,@notes,@date)
    `);
    const insertItem = this.db.prepare(`
      INSERT INTO vente_items (id,vente_id,product_id,product_name,ref,qty,price,total)
      VALUES (@id,@vente_id,@product_id,@product_name,@ref,@qty,@price,@total)
    `);
    const updateStock = this.db.prepare(
      `UPDATE products SET stock=stock-?, updated_at=datetime('now') WHERE id=?`
    );

    const addVenteTx = this.db.transaction(() => {
      insertVente.run({ id, num, ...data });
      (data.items || []).forEach(item => {
        insertItem.run({
          id: this.uuid(), vente_id: id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          ref: item.ref || '',
          qty: item.qty, price: item.price, total: item.qty * item.price
        });
        if (item.product_id) {
          updateStock.run(item.qty, item.product_id);
        }
      });
      // تحديث العداد
      this.db.prepare(`UPDATE settings SET value=? WHERE key='vente_num_counter'`).run(counter + 1);
    });

    addVenteTx();
    return { success: true, id, num };
  }

  // ===========================
  // ACHATS
  // ===========================
  getAllAchats() {
    return this.db.prepare(`
      SELECT * FROM achats WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 200
    `).all();
  }

  addAchat(data) {
    const id = this.uuid();
    const counter = parseInt(this.db.prepare(`SELECT value FROM settings WHERE key='achat_num_counter'`).get().value);
    const prefix = this.db.prepare(`SELECT value FROM settings WHERE key='achat_num_prefix'`).get().value;
    const num = `${prefix}${String(counter).padStart(5, '0')}`;

    const insertAchat = this.db.prepare(`
      INSERT INTO achats (id,num,fournisseur_id,fournisseur_name,total,paid,reste,payment_type,notes,date)
      VALUES (@id,@num,@fournisseur_id,@fournisseur_name,@total,@paid,@reste,@payment_type,@notes,@date)
    `);
    const insertItem = this.db.prepare(`
      INSERT INTO achat_items (id,achat_id,product_id,product_name,ref,qty,price,total)
      VALUES (@id,@achat_id,@product_id,@product_name,@ref,@qty,@price,@total)
    `);
    const updateStock = this.db.prepare(
      `UPDATE products SET stock=stock+?, buy_price=?, updated_at=datetime('now') WHERE id=?`
    );

    const addAchatTx = this.db.transaction(() => {
      insertAchat.run({ id, num, ...data });
      (data.items || []).forEach(item => {
        insertItem.run({
          id: this.uuid(), achat_id: id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          ref: item.ref || '',
          qty: item.qty, price: item.price, total: item.qty * item.price
        });
        if (item.product_id) {
          updateStock.run(item.qty, item.price, item.product_id);
        }
      });
      this.db.prepare(`UPDATE settings SET value=? WHERE key='achat_num_counter'`).run(counter + 1);
    });

    addAchatTx();
    return { success: true, id, num };
  }

  // ===========================
  // STATS / DASHBOARD
  // ===========================
  getDashboardStats() {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    return {
      products_count:   this.db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0`).get().c,
      low_stock_count:  this.db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0 AND stock <= stock_min AND stock > 0`).get().c,
      out_of_stock:     this.db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_deleted=0 AND stock = 0`).get().c,
      clients_count:    this.db.prepare(`SELECT COUNT(*) as c FROM clients WHERE is_deleted=0`).get().c,
      ventes_today:     this.db.prepare(`SELECT COUNT(*) as c FROM ventes WHERE is_deleted=0 AND date=?`).get(today).c,
      ventes_month:     this.db.prepare(`SELECT COUNT(*) as c FROM ventes WHERE is_deleted=0 AND date LIKE ?`).get(`${month}%`).c,
      ca_today:         this.db.prepare(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 AND date=?`).get(today).s,
      ca_month:         this.db.prepare(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 AND date LIKE ?`).get(`${month}%`).s,
      ca_total:         this.db.prepare(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0`).get().s,
      recent_ventes:    this.db.prepare(`
        SELECT v.*, vi_sum.items FROM ventes v
        LEFT JOIN (
          SELECT vente_id, GROUP_CONCAT(product_name || ' ×' || qty, ', ') as items
          FROM vente_items GROUP BY vente_id
        ) vi_sum ON v.id = vi_sum.vente_id
        WHERE v.is_deleted=0 ORDER BY v.created_at DESC LIMIT 5
      `).all(),
      low_stock_products: this.db.prepare(`
        SELECT * FROM products WHERE is_deleted=0 AND stock <= stock_min ORDER BY stock ASC LIMIT 5
      `).all(),
    };
  }

  getReports(period = 'month') {
    const now = new Date();
    let dateFilter = '';
    if (period === 'today') dateFilter = `AND date = '${now.toISOString().slice(0, 10)}'`;
    else if (period === 'month') dateFilter = `AND date LIKE '${now.toISOString().slice(0, 7)}%'`;
    else if (period === 'year') dateFilter = `AND date LIKE '${now.getFullYear()}%'`;

    return {
      total_ventes: this.db.prepare(`SELECT COALESCE(SUM(net),0) as s FROM ventes WHERE is_deleted=0 ${dateFilter}`).get().s,
      total_achats: this.db.prepare(`SELECT COALESCE(SUM(total),0) as s FROM achats WHERE is_deleted=0 ${dateFilter}`).get().s,
      ventes_by_day: this.db.prepare(`
        SELECT date, COUNT(*) as count, SUM(net) as total
        FROM ventes WHERE is_deleted=0 ${dateFilter}
        GROUP BY date ORDER BY date
      `).all(),
      top_products: this.db.prepare(`
        SELECT product_name, SUM(qty) as total_qty, SUM(total) as total_amount
        FROM vente_items vi
        JOIN ventes v ON v.id = vi.vente_id
        WHERE v.is_deleted=0 ${dateFilter}
        GROUP BY product_name ORDER BY total_qty DESC LIMIT 10
      `).all(),
      payment_types: this.db.prepare(`
        SELECT payment_type, COUNT(*) as count, SUM(net) as total
        FROM ventes WHERE is_deleted=0 ${dateFilter}
        GROUP BY payment_type
      `).all(),
    };
  }

  // ===========================
  // SETTINGS
  // ===========================
  getSettings() {
    const rows = this.db.prepare(`SELECT key, value FROM settings`).all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  saveSettings(data) {
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`);
    const tx = this.db.transaction(() => {
      Object.entries(data).forEach(([k, v]) => stmt.run(k, v));
    });
    tx();
    return { success: true };
  }
}

module.exports = DB;
