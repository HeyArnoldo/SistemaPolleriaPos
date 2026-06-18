import { contextBridge, ipcRenderer } from 'electron';

// Read the configured tenant API URL synchronously at preload time so the web's
// api client can resolve its baseURL at module init (before any request).
const apiUrl: string = ipcRenderer.sendSync('get-api-url');

contextBridge.exposeInMainWorld('electronAPI', {
  apiUrl,
  printTicket: (html: string, options?: { printerName?: string; marginsType?: number }) =>
    ipcRenderer.invoke('print-ticket', html, options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  saveConfig: (url: string) => ipcRenderer.invoke('save-config', url),
});
