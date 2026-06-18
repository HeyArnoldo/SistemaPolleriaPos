import { useEffect, useState } from 'react';
import { useMe } from '@/hooks/use-auth';
import { canAccessRoute } from '@/lib/permissions';
import { PaymentMethodsCard } from '@/components/dashboard/configuracion/payment-methods-card';
import { ResetFinancialCard } from '@/components/dashboard/configuracion/reset-financial-card';
import { PrinterSettingsCard } from '@/components/dashboard/configuracion/printer-settings-card';
import { PrinterAdvancedSettings } from '@/components/dashboard/configuracion/printer-advanced-settings';
import { PrinterDebugPanel } from '@/components/dashboard/configuracion/printer-debug-panel';
import { CashReportCard } from '@/components/dashboard/caja/cash-report-card';
import { OfflinePinCard } from '@/components/dashboard/configuracion/offline-pin-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, ShieldAlert } from 'lucide-react';
import { getPrintSettings, savePrintSettings, isElectronEnv } from '@/lib/print-settings';
import type { PrintSettings } from '@/lib/print-settings';

type PrinterInfo = {
  name: string;
  displayName?: string;
};

export default function ConfiguracionPage() {
  const { data: user } = useMe();
  const hasAccess = canAccessRoute(user?.role, 'configuracion');

  const [printSettings, setPrintSettings] = useState<PrintSettings>(getPrintSettings);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const isElectron = isElectronEnv();

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.getPrinters) return;

    setLoadingPrinters(true);
    void window.electronAPI
      .getPrinters()
      .then((result) => {
        setPrinters(result);
      })
      .catch(() => {
        setPrinters([]);
      })
      .finally(() => {
        setLoadingPrinters(false);
      });
  }, [isElectron]);

  const handleSettingsChange = (updated: PrintSettings) => {
    setPrintSettings(updated);
    savePrintSettings(updated);
  };

  const handlePrinterChange = (printerName: string) => {
    handleSettingsChange({ ...printSettings, printerName });
  };

  if (!hasAccess) {
    return (
      <div className="p-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>No tienes permiso para acceder a esta sección.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-900/90 p-3 text-white shadow-sm">
          <Printer className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Configuración del sistema
          </h1>
          <p className="text-sm text-slate-500">
            Administra impresión, métodos de pago y herramientas operativas.
          </p>
        </div>
      </div>

      {/* Debug panel (visible only when debugMode is active) */}
      <PrinterDebugPanel settings={printSettings} printers={printers} isElectron={isElectron} />

      {/* Printer settings grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PrinterSettingsCard
          isElectron={isElectron}
          isLoading={loadingPrinters}
          printers={printers}
          settings={printSettings}
          onSettingsChange={handleSettingsChange}
          onPrinterChange={handlePrinterChange}
        />

        <PrinterAdvancedSettings
          settings={printSettings}
          onSettingsChange={handleSettingsChange}
          isElectron={isElectron}
        />
      </div>

      <PaymentMethodsCard />

      <OfflinePinCard />

      <CashReportCard />

      <ResetFinancialCard />
    </div>
  );
}
