// Rakeb pour Windows (Electron) — processus principal.
const { app, BrowserWindow, shell, ipcMain, Menu, session } = require('electron');
const path = require('path');

// Seuls http(s) et mailto: sont ouverts à l'extérieur ; tout le reste est refusé.
const ALLOWED = /^(https?:|mailto:)/i;
function safeOpen(url) {
  if (typeof url === 'string' && url.length < 2048 && ALLOWED.test(url)) shell.openExternal(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 380, minHeight: 560,
    backgroundColor: '#0b1f1c',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { safeOpen(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) { event.preventDefault(); safeOpen(url); }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(() => {
    // Seules les notifications sont autorisées (rappels de prière).
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications'));
    ipcMain.handle('open-external', (_e, url) => safeOpen(url));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
