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
    update:  (id, data) => ipcRenderer.invoke('products:update', id, data),
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

  // ===== الفئات =====
  categories: {
    rename: (oldName, newName) => ipcRenderer.invoke('categories:rename', oldName, newName),
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
    getById:  (id) => ipcRenderer.invoke('ventes:getById', id),
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
