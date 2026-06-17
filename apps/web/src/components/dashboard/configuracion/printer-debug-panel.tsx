import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bug } from 'lucide-react';
import type { PrintSettings } from '@/lib/print-settings';

type PrinterInfo = {
  name: string;
  displayName?: string;
};

type PrinterDebugPanelProps = {
  settings: PrintSettings;
  printers: PrinterInfo[];
  isElectron: boolean;
};

export function PrinterDebugPanel({ settings, printers, isElectron }: PrinterDebugPanelProps) {
  if (!settings.debugMode) return null;

  if (!isElectron) {
    return (
      <Alert variant="default" className="border-amber-300 bg-amber-50">
        <Bug className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Modo Debug Activo</AlertTitle>
        <AlertDescription className="text-xs text-amber-900">
          El panel de debug con versiones de Electron y listado de impresoras solo está disponible
          en la aplicación de escritorio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="default" className="border-amber-300 bg-amber-50">
      <Bug className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Modo Debug Activo</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="text-xs font-mono space-y-1 text-amber-900">
          <div>
            <strong>Impresoras detectadas:</strong> {printers.length}
          </div>
          {printers.length > 0 && (
            <div className="pl-2 border-l-2 border-amber-300 mt-1">
              {printers.map((p) => (
                <div key={p.name}>{p.displayName ?? p.name}</div>
              ))}
            </div>
          )}
          <div className="mt-2">
            <strong>Impresora seleccionada:</strong> {settings.printerName ?? 'Ninguna'}
          </div>
          <div>
            <strong>Configuración:</strong>
          </div>
          <div className="pl-2 border-l-2 border-amber-300">
            <div>Ancho: {settings.ticketWidthMm}mm</div>
            <div>
              Márgenes: {settings.paddingTopMm}/{settings.paddingXMm}/{settings.paddingBottomMm}mm
              (top/x/bottom)
            </div>
            <div>Escala fuente: {settings.fontScale}x</div>
            <div>Ajuste altura: {settings.heightOffsetMm}mm</div>
            <div>Preview antes: {settings.previewBeforePrint ? 'Sí' : 'No'}</div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
