export type PrintResult = {
  success: boolean;
  error?: string;
  debugInfo?: string;
};

export type PrintOptions = {
  printerName?: string;
  silent?: boolean;
  ticketWidthMm: number;
  heightOffsetMm?: number;
  debugMode?: boolean;
};
