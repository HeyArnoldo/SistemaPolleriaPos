import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Read the configured tenant API URL synchronously at preload time so the web's
// api client can resolve its baseURL at module init (before any request).
const apiUrl: string = ipcRenderer.sendSync('get-api-url');

contextBridge.exposeInMainWorld('electronAPI', {
  apiUrl,
  printTicket: (html: string, options?: { printerName?: string; marginsType?: number }) =>
    ipcRenderer.invoke('print-ticket', html, options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  saveConfig: (url: string) => ipcRenderer.invoke('save-config', url),
  openSetup: () => ipcRenderer.invoke('open-setup'),
  // Auto-update: subscribe to "downloaded" (returns an unsubscribe fn) and trigger install.
  onUpdateDownloaded: (callback: (info: { version?: string }) => void) => {
    const listener = (_event: IpcRendererEvent, info: { version?: string }) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  restartToUpdate: () => ipcRenderer.invoke('quit-and-install'),
});
