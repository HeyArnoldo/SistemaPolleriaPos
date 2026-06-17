import type { PrintResult } from './types';

const isElectron = (): boolean =>
  typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';

export const printViaWeb = (html: string): PrintResult => {
  const printWindow = window.open('', '_blank', 'width=300,height=500');

  if (!printWindow) {
    return {
      success: false,
      error: 'No se pudo abrir la ventana de impresión.',
    };
  }

  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
    if (isElectron()) {
      setTimeout(() => {
        printWindow.close();
      }, 300);
    }
  };

  printWindow.addEventListener('load', triggerPrint);

  const closeAfterPrint = () => {
    if (!printWindow.closed) {
      printWindow.close();
    }
  };

  printWindow.addEventListener('afterprint', closeAfterPrint);
  setTimeout(closeAfterPrint, 1500);

  return { success: true };
};
