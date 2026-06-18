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
import { invalidateFinancialQueries } from './query-keys';

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
        const failures = result.failed ?? [];
        for (const s of pendingSales) {
          const failed = failures.find((f) => f.saleNumber === s.saleNumber);
          if (failed) {
            await markSaleFailed(s.id!, failed.error);
          } else {
            await markSaleSynced(s.id!);
          }
        }
        invalidateFinancialQueries(qc);
      }

      const pendingExpenses = await getPendingExpenses();
      if (pendingExpenses.length > 0) {
        const result = await syncExpenses({ expenses: pendingExpenses.map((e) => e.payload) });
        const failures = result.failed ?? [];
        for (const e of pendingExpenses) {
          const receipt = e.payload.receiptNumber;
          const failed = receipt ? failures.find((f) => f.receiptNumber === receipt) : undefined;
          if (failed) {
            await markExpenseFailed(e.id!, failed.error);
          } else {
            await markExpenseSynced(e.id!);
          }
        }
        invalidateFinancialQueries(qc);
      }
    } catch {
      // Network still down — will retry on next reconnect
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, qc]);

  return { syncNow, isSyncing, pendingCount: pendingCount ?? 0 };
}
