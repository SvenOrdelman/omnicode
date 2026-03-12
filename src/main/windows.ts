import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

function isAppUrl(url: string): boolean {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  return url.startsWith('file://');
}

function shouldOpenExternally(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url);
}

export function createMainWindow(): BrowserWindow {
  const iconPath =
    process.platform === 'win32'
      ? path.join(app.getAppPath(), 'assets', 'icon.ico')
      : path.join(app.getAppPath(), 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f0f',
    icon: process.platform === 'darwin' ? undefined : iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isSaveShortcut =
      input.type === 'keyDown' &&
      (input.meta || input.control) &&
      input.key.toLowerCase() === 's';

    if (!isSaveShortcut) return;

    event.preventDefault();
    mainWindow?.webContents.send('menu:save-file');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) {
      return;
    }

    event.preventDefault();
    if (shouldOpenExternally(url)) {
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
