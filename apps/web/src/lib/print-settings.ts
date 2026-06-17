export type PrintSettings = {
  previewBeforePrint: boolean;
  printerName?: string;
  ticketWidthMm: number;
  paddingTopMm: number;
  paddingXMm: number;
  paddingBottomMm: number;
  fontScale: number;
  heightOffsetMm: number;
  debugMode: boolean;
};

const STORAGE_KEY = 'pos.printSettings';

const DEFAULT_SETTINGS: PrintSettings = {
  previewBeforePrint: true,
  printerName: undefined,
  ticketWidthMm: 80,
  paddingTopMm: 0,
  paddingXMm: 2,
  paddingBottomMm: 2,
  fontScale: 1.0,
  heightOffsetMm: 0,
  debugMode: false,
};

export const getPrintSettings = (): PrintSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    return {
      previewBeforePrint: parsed.previewBeforePrint ?? DEFAULT_SETTINGS.previewBeforePrint,
      printerName: parsed.printerName ?? DEFAULT_SETTINGS.printerName,
      ticketWidthMm: parsed.ticketWidthMm ?? DEFAULT_SETTINGS.ticketWidthMm,
      paddingTopMm: parsed.paddingTopMm ?? DEFAULT_SETTINGS.paddingTopMm,
      paddingXMm: parsed.paddingXMm ?? DEFAULT_SETTINGS.paddingXMm,
      paddingBottomMm: parsed.paddingBottomMm ?? DEFAULT_SETTINGS.paddingBottomMm,
      fontScale: parsed.fontScale ?? DEFAULT_SETTINGS.fontScale,
      heightOffsetMm: parsed.heightOffsetMm ?? DEFAULT_SETTINGS.heightOffsetMm,
      debugMode: parsed.debugMode ?? DEFAULT_SETTINGS.debugMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const savePrintSettings = (settings: PrintSettings): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const isElectronEnv = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;

export const DEFAULT_PRINT_SETTINGS = DEFAULT_SETTINGS;
