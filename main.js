const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const store = require('./src/store');
const onvio = require('./src/onvio-client');
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

// Os handlers devolvem o erro como valor em vez de lançar: uma exceção que
// atravessa o IPC chega ao renderer embrulhada em "Error invoking remote
// method ...", e esse ruído apareceria para o usuário.
ipcMain.handle('onvio:login', async () => {
  try {
    return await onvio.login(mainWindow);
  } catch (err) {
    return { ok: false, mensagem: err.message || String(err) };
  }
});

ipcMain.handle('agent:send', async (_event, payload) => {
  try {
    return await runAgentTurn({ ...payload, settings: store.getSettings() });
  } catch (err) {
    return { erro: err.message || String(err) };
  }
});
