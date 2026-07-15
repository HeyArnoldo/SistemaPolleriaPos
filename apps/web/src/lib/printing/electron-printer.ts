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
    const result = await window.electronAPI.printTicket(html, {
      printerName: options.printerName,
      ticketWidthMm: options.ticketWidthMm,
      heightOffsetMm: options.heightOffsetMm ?? 0,
      debugMode: options.debugMode,
    });

    if (result.ok) {
      return { success: true, debugInfo: result.debug };
    }

    return {
      success: false,
      error: result.error ?? 'print_failed',
      debugInfo: result.debug,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};
