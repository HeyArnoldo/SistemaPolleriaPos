import { afterEach, describe, expect, it, vi } from 'vitest';
import { printViaElectron } from './electron-printer';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('printViaElectron', () => {
  it('forwards the thermal paper settings to Electron', async () => {
    const printTicket = vi.fn().mockResolvedValue({
      ok: true,
      debug: 'Width: 80mm, Height: 120mm',
    });
    vi.stubGlobal('window', { electronAPI: { printTicket } });

    const result = await printViaElectron('<html>ticket</html>', {
      printerName: 'THERMAL-80',
      silent: true,
      ticketWidthMm: 80,
      heightOffsetMm: 5,
      debugMode: true,
    });

    expect(printTicket).toHaveBeenCalledWith('<html>ticket</html>', {
      printerName: 'THERMAL-80',
      ticketWidthMm: 80,
      heightOffsetMm: 5,
      debugMode: true,
    });
    expect(result).toEqual({
      success: true,
      debugInfo: 'Width: 80mm, Height: 120mm',
    });
  });

  it('returns native print failures without hiding the diagnostics', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        printTicket: vi.fn().mockResolvedValue({
          ok: false,
          error: 'Invalid printer settings',
          debug: 'Width: 80mm, Height: 120mm',
        }),
      },
    });

    const result = await printViaElectron('<html>ticket</html>', {
      ticketWidthMm: 80,
    });

    expect(result).toEqual({
      success: false,
      error: 'Invalid printer settings',
      debugInfo: 'Width: 80mm, Height: 120mm',
    });
  });
});
