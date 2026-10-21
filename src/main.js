const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./store');

const THEMES = ['system', 'light', 'dark'];
const LOCALES = ['tr', 'en'];

const legacyDir = path.join(app.getPath('appData'), 'Dev Desk');
const legacyData = path.join(legacyDir, 'dev-desk.json');
const modernData = path.join(app.getPath('appData'), 'Elegant', 'elegant.json');
const usingLegacyData = fs.existsSync(legacyData) && !fs.existsSync(modernData);
if (usingLegacyData) app.setPath('userData', legacyDir);

let store;

function getStore() {
  if (!store) {
    const fileName = usingLegacyData ? 'dev-desk.json' : 'elegant.json';
    store = createStore(path.join(app.getPath('userData'), fileName));
  }
  return store;
}

function settingsFile() {
  return path.join(app.getPath('userData'), 'elegant-settings.json');
}

function readSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    return {
      theme: THEMES.includes(raw.theme) ? raw.theme : 'system',
      locale: LOCALES.includes(raw.locale) ? raw.locale : 'tr',
    };
  } catch {
    return { theme: 'system', locale: 'tr' };
  }
}

function writeSettings(input) {
  const current = readSettings();
  const settings = {
    theme: THEMES.includes(input?.theme) ? input.theme : current.theme,
    locale: LOCALES.includes(input?.locale) ? input.locale : current.locale,
  };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  applyTheme(settings.theme);
  return settings;
}

function applyTheme(theme) {
  nativeTheme.themeSource = THEMES.includes(theme) ? theme : 'system';
  const background = nativeTheme.shouldUseDarkColors ? '#181818' : '#FCFCFC';
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(background);
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#181818' : '#FCFCFC',
    title: 'Elegant',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, 'index.html'));
}

function registerIpc() {
  const actions = {
    'db:load': () => getStore().load(),
    'db:saveProject': (payload) => getStore().saveProject(payload),
    'db:deleteProject': (id) => getStore().deleteProject(id),
    'db:saveNote': (payload) => getStore().saveNote(payload),
    'db:deleteNote': (id) => getStore().deleteNote(id),
    'db:saveTask': (payload) => getStore().saveTask(payload),
    'db:deleteTask': (id) => getStore().deleteTask(id),
    'settings:get': () => readSettings(),
    'settings:set': (payload) => writeSettings(payload),
    'app:version': () => app.getVersion(),
  };

  for (const [channel, action] of Object.entries(actions)) {
    ipcMain.handle(channel, (_event, payload) => {
      try {
        return action(payload);
      } catch (error) {
        const message = error.code === 'VALIDATION'
          ? error.message
          : 'Kayıt sırasında bir sorun oluştu.';
        throw new Error(message);
      }
    });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  applyTheme(readSettings().theme);
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
