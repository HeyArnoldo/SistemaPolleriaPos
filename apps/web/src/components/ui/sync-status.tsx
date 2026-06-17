import { CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  className?: string;
}

export function SyncStatus({ isOnline, pendingCount, isSyncing, onSyncNow, className }: SyncStatusProps) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <button
      onClick={onSyncNow}
      disabled={!isOnline || isSyncing}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
        isOnline
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 cursor-not-allowed',
        className,
      )}
    >
      {isSyncing ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      {isOnline
        ? isSyncing
          ? 'Sincronizando...'
          : `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`
        : 'Sin conexión'}
    </button>
  );
}
