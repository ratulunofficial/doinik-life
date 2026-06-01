// Doinik Life — Desktop main process
//
// This Electron app is a thin native shell around https://doinik.life.
// Whenever the website is updated and re-deployed, the next launch (and even
// the next focus / reload) of the desktop app will pick up the new version
// automatically — no need to rebuild or reinstall the .dmg.

const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const APP_URL = 'https://doinik.life/';
const APP_NAME = 'Doinik Life';

// Ensure only one instance of the app is running.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Set the dock / process name early so macOS shows "Doinik Life" instead of
// "Electron" in the menu bar / about dialog.
app.setName(APP_NAME);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#060914', // matches the website's dark theme to avoid white flash
    show: false,
    titleBarStyle: 'hiddenInset', // native macOS traffic-light buttons, no extra chrome
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // Persist localStorage / IndexedDB so the user's data (tasks, expenses,
      // mood, etc.) survives across app launches.
      partition: 'persist:doinik-life',
    },
  });

  // Avoid white flash on launch.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the live website. The site itself ships a network-first service
  // worker, so updates propagate as soon as they're deployed.
  mainWindow.loadURL(APP_URL, { userAgent: defaultUserAgent() });

  // Open every external link / target="_blank" in the user's default browser
  // instead of spawning a second Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // If something inside the page tries to navigate off doinik.life, send the
  // user out to their default browser instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const home = new URL(APP_URL);
      if (target.host !== home.host) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) {
      // ignore malformed URLs
    }
  });

  // If the page fails to load (e.g. user is offline at launch), retry once
  // when network comes back via a manual reload trigger.
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    // Ignore aborted loads (errorCode -3) which happen during normal navigation.
    if (errorCode === -3) return;
    console.warn('Load failed:', errorCode, errorDescription, validatedURL);
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) mainWindow.loadURL(APP_URL);
    }, 4000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Use a stable, real-browser-like User-Agent string so third-party services
// embedded in the site (Google Fonts, Firebase, etc.) don't flag the app.
function defaultUserAgent() {
  const chromeVersion = process.versions.chrome;
  return (
    `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 DoinikLifeDesktop/${app.getVersion()}`
  );
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [{
          label: APP_NAME,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
              label: 'Reload Website',
              accelerator: 'CmdOrCtrl+R',
              click: () => mainWindow && mainWindow.loadURL(APP_URL),
            },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Visit doinik.life',
          click: () => shell.openExternal('https://doinik.life'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Aggressively clear HTTP cache on startup so the app always boots with the
  // latest deployed website. The site's own service worker still handles
  // offline support after that.
  session.fromPartition('persist:doinik-life').clearCache().catch(() => {});

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
