const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ===== تحكم النافذة =====
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // ===== المنتجات =====
  products: {
    getAll:  ()         => ipcRenderer.invoke('products:getAll'),
    add:     (data)     => ipcRenderer.invoke('products:add', data),
    update:      (id, data)             => ipcRenderer.invoke('products:update', id, data),
    updateStock: (id, change, reason, note, user) => ipcRenderer.invoke('products:updateStock', id, change, reason, note, user),
    stockLog:    (id)                    => ipcRenderer.invoke('products:stockLog', id),
    delete:  (id)       => ipcRenderer.invoke('products:delete', id),
    search:  (q)        => ipcRenderer.invoke('products:search', q),
  },

  // ===== العملاء =====
  clients: {
    getAll: ()         => ipcRenderer.invoke('clients:getAll'),
    add:    (data)     => ipcRenderer.invoke('clients:add', data),
    update: (id, data) => ipcRenderer.invoke('clients:update', id, data),
    delete: (id)       => ipcRenderer.invoke('clients:delete', id),
  },

  // ===== الموردين =====
  fournisseurs: {
    getAll:  ()         => ipcRenderer.invoke('fournisseurs:getAll'),
    add:     (data)     => ipcRenderer.invoke('fournisseurs:add', data),
    update:  (id, data) => ipcRenderer.invoke('fournisseurs:update', id, data),
    delete:  (id)       => ipcRenderer.invoke('fournisseurs:delete', id),
  },

  // ===== تسجيل الدخول =====
  auth: {
    login:      (username, password) => ipcRenderer.invoke('auth:login', username, password),
    resetAdmin: ()                    => ipcRenderer.invoke('auth:resetAdmin'),
  },
  // ===== الإشعارات =====
  notif: {
    getAll:    ()                    => ipcRenderer.invoke('notif:getAll'),
    getUnread: ()                    => ipcRenderer.invoke('notif:getUnread'),
    add:       (t, title, msg, s, r) => ipcRenderer.invoke('notif:add', t, title, msg, s, r),
    markRead:  ()                    => ipcRenderer.invoke('notif:markRead'),
    clear:     ()                    => ipcRenderer.invoke('notif:clear'),
    generate:  ()                    => ipcRenderer.invoke('notif:generate'),
  },
  // ===== عروض الأسعار =====
  quotes: {
    getAll:       ()         => ipcRenderer.invoke('quotes:getAll'),
    getById:      (id)       => ipcRenderer.invoke('quotes:getById', id),
    add:          (d)        => ipcRenderer.invoke('quotes:add', d),
    updateStatus: (id, s)    => ipcRenderer.invoke('quotes:updateStatus', id, s),
    delete:       (id)       => ipcRenderer.invoke('quotes:delete', id),
  },
  // ===== الخزينة =====
  sellers: {
    openSession:  (sid, sname, amt) => ipcRenderer.invoke('sellers:openSession', sid, sname, amt),
    closeSession: (sid, amt)        => ipcRenderer.invoke('sellers:closeSession', sid, amt),
    getSession:   (sid)             => ipcRenderer.invoke('sellers:getSession', sid),
    getSessions:  (date)            => ipcRenderer.invoke('sellers:getSessions', date),
  },
  variants: {
    getAll:      ()              => ipcRenderer.invoke('variants:getAll'),
    get:         (pid)          => ipcRenderer.invoke('variants:get', pid),
    add:         (d)            => ipcRenderer.invoke('variants:add', d),
    update:      (id, d)        => ipcRenderer.invoke('variants:update', id, d),
    delete:      (id)           => ipcRenderer.invoke('variants:delete', id),
    updateStock: (id, c, r, n, u) => ipcRenderer.invoke('variants:updateStock', id, c, r, n, u),
    findBarcode: (bc)           => ipcRenderer.invoke('variants:findBarcode', bc),
  },
  directDebts: {
    getAll:      ()              => ipcRenderer.invoke('directDebts:getAll'),
    add:         (d)             => ipcRenderer.invoke('directDebts:add', d),
    addPayment:  (id,amt,n,date) => ipcRenderer.invoke('directDebts:addPayment', id, amt, n, date),
    getPayments: (id)            => ipcRenderer.invoke('directDebts:getPayments', id),
    delete:      (id)            => ipcRenderer.invoke('directDebts:delete', id),
  },
  caisse: {
    getStats: ()  => ipcRenderer.invoke('caisse:getStats'),
    add:      (d) => ipcRenderer.invoke('caisse:add', d),
  },
  // ===== المرتجعات =====
  retours: {
    getAll: ()  => ipcRenderer.invoke('retours:getAll'),
    add:    (d) => ipcRenderer.invoke('retours:add', d),
  },
  // ===== الديون =====
  dettes: {
    getAll:      ()  => ipcRenderer.invoke('dettes:getAll'),
    addPayment:  (d)    => ipcRenderer.invoke('dettes:addPayment', d),
    getPayments: (id)  => ipcRenderer.invoke('dettes:getPayments', id),
    getStatement:(name)=> ipcRenderer.invoke('dettes:getStatement', name),
    getStats:    ()    => ipcRenderer.invoke('dettes:getStats'),
  },
  // ===== الولاء =====
  loyalty: {
    getAll:     ()                    => ipcRenderer.invoke('loyalty:getAll'),
    addPoints:  (ci, cn, pts, spent)  => ipcRenderer.invoke('loyalty:addPoints', ci, cn, pts, spent),
  },
  // ===== الصلاحية =====
  expiry: {
    getAll:  ()    => ipcRenderer.invoke('expiry:getAll'),
    add:     (d)   => ipcRenderer.invoke('expiry:add', d),
    delete:  (id)  => ipcRenderer.invoke('expiry:delete', id),
  },
  // ===== الفروع =====
  branches: {
    getAll:   ()         => ipcRenderer.invoke('branches:getAll'),
    add:      (d)        => ipcRenderer.invoke('branches:add', d),
    update:   (id, d)    => ipcRenderer.invoke('branches:update', id, d),
    delete:   (id)       => ipcRenderer.invoke('branches:delete', id),
  },
  // ===== المستخدمون =====
  users: {
    getAll:   ()         => ipcRenderer.invoke('users:getAll'),
    add:      (d)        => ipcRenderer.invoke('users:add', d),
    update:   (id, d)    => ipcRenderer.invoke('users:update', id, d),
    delete:   (id)       => ipcRenderer.invoke('users:delete', id),
  },
  // ===== الوحدات =====
  units: {
    getAll:  ()      => ipcRenderer.invoke('units:getAll'),
    add:     (name)  => ipcRenderer.invoke('units:add', name),
    delete:  (id)    => ipcRenderer.invoke('units:delete', id),
  },
  // ===== الفئات =====
  categories: {
    add:        (name,color,icon)    => ipcRenderer.invoke('categories:add', name, color, icon),
    getAll:     ()                   => ipcRenderer.invoke('categories:getAll'),
    updateMeta: (name, color, icon)  => ipcRenderer.invoke('categories:updateMeta', name, color, icon),
    rename:     (oldName, newName)   => ipcRenderer.invoke('categories:rename', oldName, newName),
    delete: (name)             => ipcRenderer.invoke('categories:delete', name),
  },

  // ===== النسخ الاحتياطي =====
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
  },

  // ===== المبيعات =====
  ventes: {
    getAll:   ()   => ipcRenderer.invoke('ventes:getAll'),
    add:      (d)  => ipcRenderer.invoke('ventes:add', d),
    getById:      (id)          => ipcRenderer.invoke('ventes:getById', id),
    updateNotes:  (id, notes)  => ipcRenderer.invoke('ventes:updateNotes', id, notes),
    delete:       (id)          => ipcRenderer.invoke('ventes:delete', id),
  },

  // ===== المشتريات =====
  achats: {
    getAll: ()  => ipcRenderer.invoke('achats:getAll'),
    add:    (d) => ipcRenderer.invoke('achats:add', d),
  },

  // ===== الإحصائيات =====
  stats: {
    getDashboard: ()       => ipcRenderer.invoke('stats:getDashboard'),
    getReports:   (period) => ipcRenderer.invoke('stats:getReports', period),
  },

  // ===== الإعدادات =====
  settings: {
    get:  ()     => ipcRenderer.invoke('settings:get'),
    save: (data) => ipcRenderer.invoke('settings:save', data),
  },

  // ===== الطباعة =====
  print: {
    invoice: (html) => ipcRenderer.invoke('print:invoice', html),
  },
});
