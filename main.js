const { app, BrowserWindow, ipcMain, Menu, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'whatsnote-data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load data:', err);
  }
  return { settings: {}, projects: [] };
}

function saveData(data) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.removeMenu();
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_e, data) => saveData(data));

ipcMain.handle('context-menu:message', (_e, { messageId, projectId, links, starred }) => {
  return new Promise((resolve) => {
    const items = [];

    items.push({
      label: starred ? 'Unstar Message' : 'Star Message',
      click: () => resolve({ action: 'star', messageId, projectId }),
    });

    if (links && links.length > 0) {
      items.push({ type: 'separator' });
      for (const url of links) {
        const short = url.length > 50 ? url.slice(0, 50) + '...' : url;
        items.push({
          label: `Copy: ${short}`,
          click: () => { clipboard.writeText(url); resolve(null); },
        });
        items.push({
          label: `Open: ${short}`,
          click: () => { shell.openExternal(url); resolve(null); },
        });
      }
    }

    items.push({ type: 'separator' });
    items.push({
      label: 'Delete Message',
      click: () => resolve({ action: 'delete', messageId, projectId }),
    });
    items.push({ type: 'separator' });
    items.push({ label: 'Cancel', click: () => resolve(null) });

    const menu = Menu.buildFromTemplate(items);
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => setTimeout(() => resolve(null), 100));
  });
});

ipcMain.handle('context-menu:project', (_e, { projectId, pinned }) => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      {
        label: pinned ? 'Unpin Chat' : 'Pin Chat',
        click: () => resolve({ action: 'pin', projectId }),
      },
      {
        label: 'Change Avatar',
        click: () => resolve({ action: 'avatar', projectId }),
      },
      {
        label: 'Rename Project',
        click: () => resolve({ action: 'rename', projectId }),
      },
      {
        label: 'Delete Project',
        click: () => resolve({ action: 'delete', projectId }),
      },
      { type: 'separator' },
      { label: 'Cancel', click: () => resolve(null) },
    ]);
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => setTimeout(() => resolve(null), 100));
  });
});

ipcMain.handle('shell:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.handle('data:export', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export WhatsNote Data',
    defaultPath: `whatsnote-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;

  const data = loadData();
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('data:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import WhatsNote Data',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const imported = JSON.parse(raw);
    if (!imported.projects || !Array.isArray(imported.projects)) {
      return null;
    }
    saveData(imported);
    return imported;
  } catch {
    return null;
  }
});

ipcMain.handle('dialog:pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose project avatar',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const src = result.filePaths[0];
  const ext = path.extname(src);
  const avatarDir = path.join(app.getPath('userData'), 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

  const dest = path.join(avatarDir, `${Date.now()}${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
});
