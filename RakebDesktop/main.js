const { app, BrowserWindow, shell, ipcMain, net, session, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Allow the adhan chime to play without a prior click in the window.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Needed for native Windows notifications to show the app name.
app.setAppUserModelId('com.rakeb.desktop');

// Une seule instance : une seconde ouverture ramène simplement la fenêtre existante.
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWindow());

const UA = 'Rakeb/1.1 (saoudigitallab@gmail.com) Electron';
let mainWindow = null;
let tray = null;
let quitting = false;
let trayHintShown = false;
const startHidden = process.argv.includes('--hidden');
const MAX_BYTES = 60 * 1024 * 1024; // safety cap on any single response

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function loginItemPath() {
  // Version portable : le chemin réel du .exe, pas le dossier temporaire d'extraction.
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

/* Exécution en arrière-plan : fermer la fenêtre la masque, Rakeb reste actif près de l'horloge
   et les alertes de prière continuent. « Quitter » (clic droit sur l'icône) l'arrête vraiment. */
function setupTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('Rakeb — alertes de prière actives');
  const build = () => Menu.buildFromTemplate([
    { label: 'Ouvrir Rakeb', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Lancer Rakeb au démarrage de Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings({ path: loginItemPath() }).openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, path: loginItemPath(), args: ['--hidden'] });
      }
    },
    { type: 'separator' },
    { label: 'Quitter Rakeb (arrête les alertes)', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(build());
  tray.on('click', () => showWindow());
  tray.on('right-click', () => tray.setContextMenu(build()));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#0B1F1C',
    title: 'Rakeb',
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      backgroundThrottling: false, // les alertes de prière doivent continuer fenêtre masquée
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
  mainWindow = win;
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (tray && !trayHintShown) {
      trayHintShown = true;
      try { tray.displayBalloon({ title: 'Rakeb reste actif', content: 'Les alertes de prière continuent. Clic droit sur l\'icône › Quitter pour arrêter.' }); } catch (e2) { /* ignoré */ }
    }
  });
  win.on('closed', () => { mainWindow = null; });

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
  setupTray();
  createWindow();
  app.on('activate', () => showWindow());
});

app.on('before-quit', () => { quitting = true; });

// La fenêtre est masquée (pas détruite) à la fermeture : on ne quitte donc que via « Quitter ».
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && quitting) app.quit();
});
