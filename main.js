const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Database = require('./db/database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    frame: false, backgroundColor: '#0f172a', show: false,
  });
  mainWindow.loadFile('renderer/index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
  Menu.setApplicationMenu(null);
}

app.whenReady().then(async () => {
  db = new Database();
  await db.initSQL();
  db.init();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Window controls
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize());
ipcMain.on('window:close', () => mainWindow.close());

// Products
ipcMain.handle('products:getAll',  ()        => db.getAllProducts());
ipcMain.handle('products:add',     (_, d)    => db.addProduct(d));
ipcMain.handle('products:update',  (_, i, d) => db.updateProduct(i, d));
ipcMain.handle('products:delete',  (_, i)    => db.deleteProduct(i));
ipcMain.handle('products:search',  (_, q)    => db.searchProducts(q));

// Clients
ipcMain.handle('clients:getAll',   ()        => db.getAllClients());
ipcMain.handle('clients:add',      (_, d)    => db.addClient(d));
ipcMain.handle('clients:update',   (_, i, d) => db.updateClient(i, d));
ipcMain.handle('clients:delete',   (_, i)    => db.deleteClient(i));

// Fournisseurs
ipcMain.handle('fournisseurs:getAll', ()     => db.getAllFournisseurs());
ipcMain.handle('fournisseurs:add',    (_, d) => db.addFournisseur(d));

// Ventes
ipcMain.handle('ventes:getAll',    ()        => db.getAllVentes());
ipcMain.handle('ventes:add',       (_, d)    => db.addVente(d));
ipcMain.handle('ventes:getById',   (_, i)    => db.getVenteById(i));

// Achats
ipcMain.handle('achats:getAll',    ()        => db.getAllAchats());
ipcMain.handle('achats:add',       (_, d)    => db.addAchat(d));

// Stats
ipcMain.handle('stats:getDashboard', ()      => db.getDashboardStats());
ipcMain.handle('stats:getReports',   (_, p)  => db.getReports(p));

// Settings
ipcMain.handle('settings:get',     ()        => db.getSettings());
ipcMain.handle('settings:save',    (_, d)    => db.saveSettings(d));

// Print
ipcMain.handle('print:invoice', (_, html) => {
  const win = new BrowserWindow({ width:800, height:600, show:false,
    webPreferences:{ contextIsolation:true } });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  win.webContents.once('did-finish-load', () => {
    win.webContents.print({ silent:false, printBackground:true }, () => win.close());
  });
  return true;
});
