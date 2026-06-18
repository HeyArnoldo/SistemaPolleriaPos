import { Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function TenantSettingsCard() {
  const apiUrl = window.electronAPI?.apiUrl ?? '';

  function handleChange() {
    void window.electronAPI?.openSetup?.();
  }

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Server className="h-4 w-4 text-slate-500" />
          Sucursal (URL del API)
        </CardTitle>
        <p className="text-sm text-slate-500">
          API al que se conecta esta terminal. Cambiala si moviste la terminal de sucursal o cambió
          la dirección del servidor.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">URL actual</span>
          <p className="break-all rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            {apiUrl || 'Sin configurar'}
          </p>
        </div>
        <Button onClick={handleChange} className="bg-slate-900 text-white hover:bg-slate-700">
          Cambiar sucursal
        </Button>
      </CardContent>
    </Card>
  );
}
