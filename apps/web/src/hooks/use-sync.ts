import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { syncSales } from '@/services/sales.api';
import { syncExpenses } from '@/services/cash.api';
import {
  getPendingSales,
  getPendingExpenses,
  markSaleSynced,
  markExpenseSynced,
  markSaleFailed,
  markExpenseFailed,
  countPending,
} from '@/lib/queue-manager';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from './query-keys';

export function useSync() {
  const qc = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(() => countPending(), [], 0);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const pendingSales = await getPendingSales();
      if (pendingSales.length > 0) {
        const result = await syncSales({ sales: pendingSales.map((s) => s.payload) });
        for (const s of pendingSales) {
          const failed = result.failed.find((f) => f.saleNumber === s.saleNumber);
          if (failed) {
            await markSaleFailed(s.id!, failed.error);
          } else {
            await markSaleSynced(s.id!);
          }
        }
        qc.invalidateQueries({ queryKey: QUERY_KEYS.sales });
      }

      const pendingExpenses = await getPendingExpenses();
      if (pendingExpenses.length > 0) {
        const result = await syncExpenses({ expenses: pendingExpenses.map((e) => e.payload) });
        for (const e of pendingExpenses) {
          const failed = result.failed.find((f) => f.id === e.clientId);
          if (failed) {
            await markExpenseFailed(e.id!, failed.error);
          } else {
            await markExpenseSynced(e.id!);
          }
        }
        qc.invalidateQueries({ queryKey: ['expenses'] });
        qc.invalidateQueries({ queryKey: ['cash-dashboard'] });
      }
    } catch {
      // Network still down — will retry on next reconnect
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, qc]);

  return { syncNow, isSyncing, pendingCount: pendingCount ?? 0 };
}
