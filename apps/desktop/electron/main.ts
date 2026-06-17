import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:8090';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Pollería Carbón — POS',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(WEB_URL);
  win.setMenuBarVisibility(false);

  return win;
}

app.whenReady().then(() => {
  // Allow cookies from the API (same-site lax with httpOnly cookies via axios)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:3000; script-src 'self'; style-src 'self' 'unsafe-inline'",
        ],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('print-ticket', async (_event, htmlContent: string) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true },
  });

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return new Promise<void>((resolve, reject) => {
    printWin.webContents.print({ silent: true, printBackground: true }, (success, errorType) => {
      printWin.destroy();
      if (success) resolve();
      else reject(new Error(errorType));
    });
  });
});
