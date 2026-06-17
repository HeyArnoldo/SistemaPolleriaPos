import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  printTicket: (htmlContent: string) => ipcRenderer.invoke('print-ticket', htmlContent),
  saveConfig: (webUrl: string) => ipcRenderer.invoke('save-config', webUrl),
});
