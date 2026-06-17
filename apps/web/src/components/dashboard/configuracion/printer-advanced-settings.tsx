import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Printer, Settings2, Bug } from 'lucide-react';
import { buildTicketHtml } from '@/lib/ticket';
import { printTicket } from '@/lib/printing';
import type { PrintSettings } from '@/lib/print-settings';

// Minimal test sale for test print
const TEST_SALE_ID = 0;

type PrinterAdvancedSettingsProps = {
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
  isElectron: boolean;
};

export function PrinterAdvancedSettings({
  settings,
  onSettingsChange,
  isElectron,
}: PrinterAdvancedSettingsProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [lastPrintResult, setLastPrintResult] = useState<string | null>(null);

  const handleTestPrint = async () => {
    setIsPrinting(true);
    setLastPrintResult(null);

    const testSale = {
      id: TEST_SALE_ID,
      saleNumber: 'TEST-001',
      createdAt: new Date().toISOString(),
      items: [
        {
          productId: 1,
          quantity: 2,
          unitPrice: 35,
          subtotal: 70,
          product: {
            id: 1,
            name: 'Pollo a la brasa',
            price: 35,
            isActive: true,
            createdAt: '',
            updatedAt: '',
            category: { id: 1, name: 'Platos', createdAt: '', updatedAt: '' },
          },
        },
        {
          productId: 2,
          quantity: 1,
          unitPrice: 12,
          subtotal: 12,
          product: {
            id: 2,
            name: 'Papas fritas',
            price: 12,
            isActive: true,
            createdAt: '',
            updatedAt: '',
            category: { id: 1, name: 'Platos', createdAt: '', updatedAt: '' },
          },
        },
      ],
      payments: [
        {
          paymentMethodId: 1,
          amount: 100,
          paymentMethod: {
            id: 1,
            name: 'Efectivo',
            commissionPercentage: 0,
            requiresTransferTime: false,
            isActive: true,
            createdAt: '',
            updatedAt: '',
          },
        },
      ],
      totalAmount: 82,
    };

    try {
      const html = buildTicketHtml(testSale, settings);
      const result = await printTicket(html, settings);

      if (result.success) {
        toast.success('Ticket de prueba enviado a la impresora');
        if (result.debugInfo) {
          setLastPrintResult(`OK: ${result.debugInfo}`);
        }
      } else {
        toast.error(`Error al imprimir: ${result.error ?? 'Error desconocido'}`);
        setLastPrintResult(
          `Error: ${result.error ?? ''}${result.debugInfo ? ` | ${result.debugInfo}` : ''}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error: ${message}`);
      setLastPrintResult(`Exception: ${message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const updateSetting = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configuración avanzada de impresión
        </CardTitle>
        <CardDescription>
          Ajusta los parámetros del ticket para tu impresora térmica.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ancho del ticket */}
        <div className="space-y-2">
          <Label htmlFor="ticketWidth">Ancho del ticket (mm)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ticketWidth"
              type="number"
              min={40}
              max={100}
              step={1}
              value={settings.ticketWidthMm}
              onChange={(e) => updateSetting('ticketWidthMm', Number(e.target.value) || 80)}
              className="w-24"
            />
            <span className="text-sm text-slate-500">(58mm o 80mm son los más comunes)</span>
          </div>
        </div>

        {/* Márgenes */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paddingTop">Margen superior (mm)</Label>
            <Input
              id="paddingTop"
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={settings.paddingTopMm}
              onChange={(e) => updateSetting('paddingTopMm', Number(e.target.value) || 0)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paddingX">Margen horizontal (mm)</Label>
            <Input
              id="paddingX"
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={settings.paddingXMm}
              onChange={(e) => updateSetting('paddingXMm', Number(e.target.value) || 0)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paddingBottom">Margen inferior (mm)</Label>
            <Input
              id="paddingBottom"
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={settings.paddingBottomMm}
              onChange={(e) => updateSetting('paddingBottomMm', Number(e.target.value) || 0)}
              className="w-full"
            />
          </div>
        </div>

        {/* Escala de fuente */}
        <div className="space-y-2">
          <Label htmlFor="fontScale">Escala de fuente</Label>
          <div className="flex items-center gap-2">
            <Input
              id="fontScale"
              type="number"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.fontScale}
              onChange={(e) => updateSetting('fontScale', Number(e.target.value) || 1)}
              className="w-24"
            />
            <span className="text-sm text-slate-500">
              (1.0 = normal, 0.8 = más pequeño, 1.2 = más grande)
            </span>
          </div>
        </div>

        {/* Ajuste de altura */}
        <div className="space-y-2">
          <Label htmlFor="heightOffset">Ajuste de altura (mm)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="heightOffset"
              type="number"
              min={-100}
              max={100}
              step={1}
              value={settings.heightOffsetMm}
              onChange={(e) => updateSetting('heightOffsetMm', Number(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-sm text-slate-500">
              (0 = auto, negativo = menos altura, positivo = más altura)
            </span>
          </div>
        </div>

        {/* Modo debug */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="debugMode"
            checked={settings.debugMode}
            onCheckedChange={(checked) => updateSetting('debugMode', checked === true)}
          />
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-amber-600" />
            <Label htmlFor="debugMode" className="cursor-pointer">
              Modo debug (muestra ventana de impresión y logs)
            </Label>
          </div>
        </div>

        {/* Botón de prueba */}
        {isElectron && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <Button
              onClick={() => void handleTestPrint()}
              disabled={isPrinting || !settings.printerName}
              className="w-full"
              variant="outline"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isPrinting ? 'Imprimiendo...' : 'Imprimir ticket de prueba'}
            </Button>

            {!settings.printerName && (
              <p className="text-xs text-amber-600">
                Selecciona una impresora arriba para poder hacer pruebas.
              </p>
            )}

            {lastPrintResult && (
              <div className="p-3 bg-slate-100 rounded-md text-xs font-mono break-all">
                {lastPrintResult}
              </div>
            )}
          </div>
        )}

        {!isElectron && (
          <p className="text-xs text-slate-500 italic">
            La configuración avanzada solo aplica en el entorno de escritorio (Electron).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
