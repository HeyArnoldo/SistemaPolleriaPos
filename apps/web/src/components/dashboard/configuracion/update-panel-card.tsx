import { useEffect, useState } from 'react';
import { RefreshCw, RotateCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { UpdateStatus } from '@/types/models';

function describe(status: UpdateStatus | null): { text: string; tone: string } {
  switch (status?.state) {
    case 'checking':
      return { text: 'Buscando actualizaciones...', tone: 'text-slate-500' };
    case 'available':
      return {
        text: `Actualización ${status.version ?? ''} disponible. Descargando...`,
        tone: 'text-blue-600',
      };
    case 'downloading':
      return { text: `Descargando... ${status.percent ?? 0}%`, tone: 'text-blue-600' };
    case 'downloaded':
      return {
        text: `Versión ${status.version ?? 'nueva'} lista. Reiniciá para aplicarla.`,
        tone: 'text-emerald-600',
      };
    case 'not-available':
      return { text: 'Estás en la última versión.', tone: 'text-emerald-600' };
    case 'error':
      return { text: `Error: ${status.message ?? 'desconocido'}`, tone: 'text-red-600' };
    default:
      return { text: '', tone: 'text-slate-500' };
  }
}

export function UpdatePanelCard() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void window.electronAPI?.getAppVersion?.().then(setVersion);
    return window.electronAPI?.onUpdateStatus?.((s) => {
      setStatus(s);
      if (s.state !== 'checking' && s.state !== 'downloading') setChecking(false);
    });
  }, []);

  async function handleCheck() {
    setChecking(true);
    setStatus({ state: 'checking' });
    await window.electronAPI?.checkForUpdates?.();
  }

  const { text, tone } = describe(status);

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <RefreshCw className="h-4 w-4 text-slate-500" />
          Actualizaciones
        </CardTitle>
        <p className="text-sm text-slate-500">
          Versión instalada: <span className="font-mono text-slate-700">{version || '—'}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {text && <p className={`text-sm ${tone}`}>{text}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCheck}
            disabled={checking || status?.state === 'downloading'}
            className="bg-slate-900 text-white hover:bg-slate-700"
          >
            {checking ? 'Buscando...' : 'Buscar actualizaciones'}
          </Button>
          {status?.state === 'downloaded' && (
            <Button
              onClick={() => void window.electronAPI?.restartToUpdate?.()}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <RotateCw className="mr-1.5 h-4 w-4" />
              Reiniciar para actualizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
