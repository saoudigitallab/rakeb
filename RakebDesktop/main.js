const { app, BrowserWindow, shell, ipcMain, net, session } = require('electron');
const path = require('path');

// Allow the adhan chime to play without a prior click in the window.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Needed for native Windows notifications to show the app name.
app.setAppUserModelId('com.rakeb.desktop');

const UA = 'Rakeb-Desktop/1.1 (+desktop app; contact: local)';
const MAX_BYTES = 60 * 1024 * 1024; // safety cap on any single response

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#0B1F1C',
    title: 'Rakeb',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');

  // Links opened by the page (maps, articles, quran.com…) go to the
  // system browser instead of a new in-app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:\/\/|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Never let the main window navigate away from the app itself.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^(https?:\/\/|mailto:)/i.test(url)) shell.openExternal(url); }
  });
}

// Only what the app really needs: location, notifications, clipboard write.
function setupPermissions() {
  const allowed = new Set(['geolocation', 'notifications', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}

/*
 * Network bridge. Requests to third-party APIs (Quran, hadith, Overpass,
 * Anthropic, geocoding, RSS…) are made here in the main process, so they
 * are not blocked by browser CORS rules. Only http(s) URLs are accepted.
 */
ipcMain.handle('net:request', async (_event, opts) => {
  try {
    const { url, method = 'GET', headers = {}, body, timeout = 20000 } = opts || {};
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { error: 'URL non autorisée' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(Number(timeout) || 20000, 60000));
    try {
      const res = await net.fetch(url, {
        method,
        headers: { 'User-Agent': UA, ...headers },
        body: body === undefined ? undefined : String(body),
        signal: ctrl.signal,
        redirect: 'follow'
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) return { error: 'Réponse trop volumineuse' };
      return { status: res.status, text: buf.toString('utf8') };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { error: (e && e.name === 'AbortError') ? 'Délai dépassé' : String((e && e.message) || e) };
  }
});

app.whenReady().then(() => {
  setupPermissions();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
