// Doinik Life — desktop app (Windows / macOS).
// Serves the built web app (dist/) from a tiny local server on 127.0.0.1 so it runs
// on a "localhost" origin: Firebase Auth allows localhost by default, storage persists,
// and the app works offline. Data syncs through the same Firebase account as the website.

const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
// Fixed port → stable origin → the login session and local cache survive restarts.
const PORTS = [47836, 47837, 47838, 47839];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function serve(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(DIST, 'index.html'); // SPA fallback
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(target).pipe(res);
  });
}

// Loopback only (IPv4 + IPv6) — never reachable from the network.
function startServer() {
  return new Promise((resolve, reject) => {
    const tryPort = (i) => {
      if (i >= PORTS.length) return reject(new Error('No free port'));
      const v4 = http.createServer(serve);
      v4.once('error', () => tryPort(i + 1));
      v4.listen(PORTS[i], '127.0.0.1', () => {
        const v6 = http.createServer(serve);
        v6.once('error', () => {}); // no IPv6 loopback on this machine — fine
        v6.listen(PORTS[i], '::1');
        resolve(PORTS[i]);
      });
    };
    tryPort(0);
  });
}

// ── remember window size / position ──
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return { width: 1360, height: 860 };
  }
}
function saveState(win) {
  if (win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* ignore */
  }
}

let mainWindow = null;
let baseUrl = '';

function createWindow() {
  const st = loadState();
  mainWindow = new BrowserWindow({
    x: st.x,
    y: st.y,
    width: st.width || 1360,
    height: st.height || 860,
    minWidth: 380,
    minHeight: 600,
    show: false,
    title: 'Doinik Life',
    backgroundColor: '#0b0919',
    autoHideMenuBar: true,
    icon: path.join(DIST, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false }
  });
  if (st.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => saveState(mainWindow));

  // Links that leave the app open in the normal browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.loadURL(baseUrl + '/');
}

function buildMenu() {
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null);
  // macOS needs an Edit menu for Cmd+C / Cmd+V to work.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }])
  );
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark';
    buildMenu();
    const port = await startServer();
    baseUrl = `http://localhost:${port}`;
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
