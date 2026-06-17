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
    : '--:--';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Control de Caja</p>
        <h1 className="text-2xl font-bold">Ajustes del Dia</h1>
        {isAdmin && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Solo administradores pueden anular ventas y egresos
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Actualizado {updatedTime}</span>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>
    </div>
  );
}
