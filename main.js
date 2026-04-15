const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const Database = require('./db/database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,          // بدون شريط العنوان الافتراضي
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // فتح DevTools في وضع التطوير
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  Menu.setApplicationMenu(null);
}

// ===== تهيئة التطبيق =====
app.whenReady().then(() => {
  db = new Database();
  db.init();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC: تحكم النافذة =====
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// ===== IPC: المنتجات =====
ipcMain.handle('products:getAll', () => db.getAllProducts());
ipcMain.handle('products:add', (_, data) => db.addProduct(data));
ipcMain.handle('products:update', (_, id, data) => db.updateProduct(id, data));
ipcMain.handle('products:delete', (_, id) => db.deleteProduct(id));
ipcMain.handle('products:search', (_, q) => db.searchProducts(q));

// ===== IPC: العملاء =====
ipcMain.handle('clients:getAll', () => db.getAllClients());
ipcMain.handle('clients:add', (_, data) => db.addClient(data));
ipcMain.handle('clients:update', (_, id, data) => db.updateClient(id, data));
ipcMain.handle('clients:delete', (_, id) => db.deleteClient(id));

// ===== IPC: الموردين =====
ipcMain.handle('fournisseurs:getAll', () => db.getAllFournisseurs());
ipcMain.handle('fournisseurs:add', (_, data) => db.addFournisseur(data));

// ===== IPC: المبيعات =====
ipcMain.handle('ventes:getAll', () => db.getAllVentes());
ipcMain.handle('ventes:add', (_, data) => db.addVente(data));
ipcMain.handle('ventes:getById', (_, id) => db.getVenteById(id));

// ===== IPC: المشتريات =====
ipcMain.handle('achats:getAll', () => db.getAllAchats());
ipcMain.handle('achats:add', (_, data) => db.addAchat(data));

// ===== IPC: الإحصائيات =====
ipcMain.handle('stats:getDashboard', () => db.getDashboardStats());
ipcMain.handle('stats:getReports', (_, period) => db.getReports(period));

// ===== IPC: الإعدادات =====
ipcMain.handle('settings:get', () => db.getSettings());
ipcMain.handle('settings:save', (_, data) => db.saveSettings(data));

// ===== IPC: الطباعة =====
ipcMain.handle('print:invoice', (_, data) => {
  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { contextIsolation: true }
  });
  win.loadURL('data:text/html,' + encodeURIComponent(data));
  win.webContents.once('did-finish-load', () => {
    win.webContents.print({ silent: false, printBackground: true }, (success) => {
      win.close();
    });
  });
  return true;
});
