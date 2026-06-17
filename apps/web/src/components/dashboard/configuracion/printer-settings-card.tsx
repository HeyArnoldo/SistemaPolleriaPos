import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PrintSettings } from '@/lib/print-settings';

type PrinterInfo = {
  name: string;
  displayName?: string;
};

type PrinterSettingsCardProps = {
  isElectron: boolean;
  isLoading: boolean;
  printers: PrinterInfo[];
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
  onPrinterChange: (printerName: string) => void;
};

export function PrinterSettingsCard({
  isElectron,
  isLoading,
  printers,
  settings,
  onSettingsChange,
  onPrinterChange,
}: PrinterSettingsCardProps) {
  const selectedPrinterLabel =
    printers.find((p) => p.name === settings.printerName)?.displayName ?? settings.printerName;

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle>Impresora de tickets</CardTitle>
        <CardDescription>Configura la impresora POS y las opciones de impresión.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isElectron ? (
          <div className="space-y-1">
            <Label>Impresora POS</Label>
            <Select
              value={settings.printerName ?? ''}
              onValueChange={onPrinterChange}
              disabled={isLoading || printers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isLoading ? 'Buscando impresoras...' : 'Selecciona una impresora'}
                />
              </SelectTrigger>
              <SelectContent>
                {printers.map((printer) => (
                  <SelectItem key={printer.name} value={printer.name}>
                    {printer.displayName ?? printer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPrinterLabel && (
              <p className="text-xs text-slate-500">Seleccionada: {selectedPrinterLabel}</p>
            )}
            {printers.length === 0 && !isLoading && (
              <p className="text-xs text-amber-700">No se encontraron impresoras en este equipo.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            La selección de impresora solo está disponible en la aplicación de escritorio.
          </p>
        )}

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox
            id="previewBeforePrint"
            checked={settings.previewBeforePrint}
            onCheckedChange={(checked) =>
              onSettingsChange({ ...settings, previewBeforePrint: checked === true })
            }
          />
          <Label htmlFor="previewBeforePrint" className="cursor-pointer">
            Previsualizar ticket antes de imprimir
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
