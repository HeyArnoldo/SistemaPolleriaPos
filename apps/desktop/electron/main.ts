import { app, BrowserWindow, ipcMain, session, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';

// Pin a clean app name BEFORE any app.getPath('userData') call, so the user-data
// folder is %APPDATA%/PolleriaPOS instead of the scoped npm package name
// (@app/desktop). Must run before CONFIG_FILE below is evaluated.
app.setName('PolleriaPOS');

// ── Tenant config ───────────────────────────────────────────────────────────
// Fat client: the web is bundled inside the app and loaded locally, so the app
// opens with or without internet. Only the API URL is configured per tenant.
interface TenantConfig {
  apiUrl: string;
}

const CONFIG_FILE = join(app.getPath('userData'), 'config.json');

function readConfig(): TenantConfig | null {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { apiUrl?: string; webUrl?: string };
    // apiUrl is the new field; webUrl is the legacy thin-client field, ignored.
    if (typeof parsed.apiUrl === 'string' && parsed.apiUrl.startsWith('http')) {
      return { apiUrl: parsed.apiUrl };
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

// ── Bundled web (custom app:// protocol with SPA fallback) ───────────────────
const WEB_DIR = join(__dirname, 'web');
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://-/`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const filePath = join(WEB_DIR, pathname);
    // Serve the real asset when it exists; otherwise fall back to index.html so
    // client-side routes (BrowserRouter) resolve under file loading.
    const serve =
      pathname !== '/' && existsSync(filePath) && statSync(filePath).isFile()
        ? filePath
        : join(WEB_DIR, 'index.html');
    return net.fetch(pathToFileURL(serve).toString());
  });
}

// ── Setup window (asks for the tenant API URL, once) ─────────────────────────
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
  </style>
</head>
<body>
  <div class="card">
    <h2>Configurar sucursal</h2>
    <p class="sub">Ingresa la URL del API asignada a esta sucursal. Solo necesitas hacerlo una vez.</p>
    <label for="url">URL del API</label>
    <input id="url" type="url" placeholder="https://api-polleria-tusucursal.groowtech.com" autocomplete="off" />
    <div class="error" id="err"></div>
    <button onclick="save()">Guardar y continuar</button>
  </div>
  <script>
    // Prefill with the current URL when reconfiguring; empty on first setup.
    document.getElementById('url').value =
      (window.electronAPI && window.electronAPI.apiUrl) || '';
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
let setupWindow: BrowserWindow | null = null;

// Window/taskbar icon shipped next to main.js by copy-web.mjs. The Windows exe
// icon is embedded by electron-builder; this covers the window chrome and dev.
const ICON_PATH = join(__dirname, 'icon.png');
const windowIcon = existsSync(ICON_PATH) ? ICON_PATH : undefined;

function createSetupWindow(): BrowserWindow {
  // Reuse the existing setup window instead of stacking duplicates.
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return setupWindow;
  }
  const win = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    title: 'Configuración de sucursal — Pollería POS',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.on('closed', () => {
    setupWindow = null;
  });
  setupWindow = win;
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SETUP_HTML)}`);
  return win;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Pollería POS',
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  if (app.isPackaged) {
    void win.loadURL(APP_ORIGIN);
  } else {
    // Dev: the Vite dev server serves the web with its /api and /health proxy.
    void win.loadURL(process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173');
  }
  return win;
}

app.whenReady().then(() => {
  registerAppProtocol();

  // CSP: allow the bundled app origin + the remote API (https/wss) for fetch.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' app:; connect-src 'self' app: https: wss: http://localhost:*; script-src 'self' 'unsafe-inline' app:; style-src 'self' 'unsafe-inline' app:; img-src 'self' app: data: https:;",
        ],
      },
    });
  });

  const config = readConfig();
  if (!config) {
    createSetupWindow();
  } else {
    mainWindow = createMainWindow();
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (readConfig()) mainWindow = createMainWindow();
      else createSetupWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Synchronous bridge so the renderer reads the configured API URL at module init.
ipcMain.on('get-api-url', (event) => {
  event.returnValue = readConfig()?.apiUrl ?? '';
});

ipcMain.handle('save-config', (_event, apiUrl: string) => {
  writeConfig({ apiUrl });
  BrowserWindow.getAllWindows().forEach((w) => w.close());
  mainWindow = createMainWindow();
  if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();
});

// Re-open the setup window so the operator can change the branch API URL without
// hunting for config.json. The setup form is prefilled with the current URL.
ipcMain.handle('open-setup', () => {
  createSetupWindow();
});

ipcMain.handle(
  'print-ticket',
  async (_event, html: string, options?: { printerName?: string; marginsType?: number }) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true },
    });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return new Promise<void>((resolve, reject) => {
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          ...(options?.printerName ? { deviceName: options.printerName } : {}),
          ...(options?.marginsType !== undefined ? { marginsType: options.marginsType } : {}),
        },
        (success, errorType) => {
          printWin.destroy();
          if (success) resolve();
          else reject(new Error(errorType));
        },
      );
    });
  },
);

ipcMain.handle('get-printers', async () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  const printers = await win.webContents.getPrintersAsync();
  return printers.map((p) => ({ name: p.name, displayName: p.displayName }));
});
