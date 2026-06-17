import { isElectronEnv } from '../print-settings';
import { printViaElectron } from './electron-printer';
import { printViaWeb } from './web-printer';
import type { PrintResult } from './types';
import type { PrintSettings } from '../print-settings';

export type { PrintResult } from './types';

export const printTicket = async (html: string, settings: PrintSettings): Promise<PrintResult> => {
  if (isElectronEnv() && settings.printerName) {
    const result = await printViaElectron(html, {
      printerName: settings.printerName,
      silent: true,
      ticketWidthMm: settings.ticketWidthMm,
      heightOffsetMm: settings.heightOffsetMm,
      debugMode: settings.debugMode,
    });

    if (result.success) {
      return result;
    }

    console.warn('Electron print failed, falling back to web:', result.error);
  }

  return printViaWeb(html);
};
