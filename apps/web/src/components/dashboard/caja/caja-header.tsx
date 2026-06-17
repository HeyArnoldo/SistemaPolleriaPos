import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CajaHeaderProps {
  dataUpdatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
  isAdmin: boolean;
}

export function CajaHeader({ dataUpdatedAt, isFetching, onRefresh, isAdmin }: CajaHeaderProps) {
  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Lima',
      })
    : 'Sin actualizar';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Control de Caja
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ajustes del Dia</h1>
        <p className="text-sm text-slate-500">
          Actualizado {updatedTime}
          {isFetching ? ' (actualizando...)' : ''}
        </p>
        {isAdmin && (
          <p className="text-xs text-slate-500">
            Solo administradores pueden editar o anular ventas y egresos desde esta vista.
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
        <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
        Actualizar
      </Button>
    </div>
  );
}
