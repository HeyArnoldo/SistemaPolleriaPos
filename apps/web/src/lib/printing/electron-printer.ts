import type { PrintOptions, PrintResult } from './types';

export const printViaElectron = async (
  html: string,
  options: PrintOptions,
): Promise<PrintResult> => {
  if (typeof window === 'undefined' || !window.electronAPI?.printTicket) {
    return {
      success: false,
      error: 'Electron print API not available',
    };
  }

  try {
    await window.electronAPI.printTicket(html, {
      printerName: options.printerName,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};
