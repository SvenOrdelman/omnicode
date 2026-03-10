import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { createMainWindow } from './windows';
import { createAppMenu } from './menu';
import { registerAllHandlers } from './ipc';
import { providerRegistry } from './providers/registry';
import { ClaudeProvider } from './providers/claude';
import { getAuthStatus } from './services/auth.service';
import { closeDatabase } from './services/database.service';
import { closeAllTerminals } from './services/terminal.service';

if (started) {
  app.quit();
}

// Register provider
const claudeProvider = new ClaudeProvider();
providerRegistry.register(claudeProvider);

app.on('ready', async () => {
  // Register IPC handlers before creating windows
  registerAllHandlers();

  // Check CLI auth status and configure provider if authenticated
  try {
    const status = await getAuthStatus();
    if (status.authenticated) {
      claudeProvider.configure({});
    }
  } catch {
    // CLI not available or auth check failed - user will see login prompt
  }

  createAppMenu();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('before-quit', () => {
  closeAllTerminals();
  closeDatabase();
});
