const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const store = require('./src/store');
const dominio = require('./src/dominio-tools');
const { runAgentTurn } = require('./src/agent');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'Domínio Agent — Assistente Contábil',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:save', (_event, settings) => store.saveSettings(settings));

ipcMain.handle('dominio:test', async (_event, config) => {
  return dominio.testarConexao(config || {});
});

ipcMain.handle('agent:send', async (_event, payload) => {
  const settings = store.getSettings();
  return runAgentTurn({ ...payload, settings });
});
