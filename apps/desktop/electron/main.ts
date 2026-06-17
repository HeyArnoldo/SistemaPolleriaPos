import { app, BrowserWindow, ipcMain, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

interface TenantConfig {
  webUrl: string;
}

const CONFIG_FILE = join(app.getPath('userData'), 'config.json');

function readConfig(): TenantConfig | null {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { webUrl?: string };
    if (typeof parsed.webUrl === 'string' && parsed.webUrl.startsWith('http')) {
      return { webUrl: parsed.webUrl };
    }
    return null;
  } catch {
    return null;
  }
}

function writeConfig(config: TenantConfig): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

const SETUP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Configuración de sucursal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; width: 420px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.07); }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 6px; color: #0f172a; }
    .sub { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }
    input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
    .error { color: #dc2626; font-size: 12px; margin-top: 6px; min-height: 16px; }
    button { margin-top: 20px; width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    button:active { background: #1e40af; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Configurar sucursal</h2>
    <p class="sub">Ingresa la URL del sistema asignada a esta sucursal. Solo necesitas hacer esto una vez.</p>
    <label for="url">URL de la sucursal</label>
    <input id="url" type="url" placeholder="https://polleria-tusucursal.groowtech.com" autocomplete="off" />
    <div class="error" id="err"></div>
    <button onclick="save()">Guardar y continuar</button>
  </div>
  <script>
    document.getElementById('url').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') save();
    });
    function save() {
      const url = document.getElementById('url').value.trim();
      const err = document.getElementById('err');
      if (!url.startsWith('http')) {
        err.textContent = 'Ingresa una URL válida (debe empezar con https://)';
        return;
      }
      err.textContent = '';
      window.electronAPI.saveConfig(url);
    }
  </script>
</body>
</html>`;

let mainWindow: BrowserWindow | null = null;

function createSetupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    title: 'Configuración de sucursal — Pollería POS',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SETUP_HTML)}`);
  return win;
}

function createMainWindow(webUrl: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Pollería POS',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  void win.loadURL(webUrl);
  return win;
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
        ],
      },
    });
  });

  const config = readConfig();

  if (!config) {
    createSetupWindow();
  } else {
    mainWindow = createMainWindow(config.webUrl);
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const currentConfig = readConfig();
      if (currentConfig) {
        mainWindow = createMainWindow(currentConfig.webUrl);
      } else {
        createSetupWindow();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save-config', (_event, webUrl: string) => {
  writeConfig({ webUrl });
  const setupWins = BrowserWindow.getAllWindows();
  setupWins.forEach((w) => w.close());
  mainWindow = createMainWindow(webUrl);
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
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
