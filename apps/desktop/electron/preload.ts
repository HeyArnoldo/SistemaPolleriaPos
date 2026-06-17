import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  printTicket: (html: string, options?: { printerName?: string; marginsType?: number }) =>
    ipcRenderer.invoke('print-ticket', html, options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  saveConfig: (webUrl: string) => ipcRenderer.invoke('save-config', webUrl),
});
