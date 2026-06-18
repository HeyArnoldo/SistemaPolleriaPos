import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Persists part of the React Query cache to localStorage so the catalog is
 * available offline from a cold start (the desktop fat client opens without
 * internet, and the cashier still needs products + payment methods to sell).
 */
export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'pos-query-cache',
});

// Only the catalog is persisted — NOT auth/me, sales, dashboard or BI
// (live or sensitive data that shouldn't be served stale from disk).
const CATALOG_KEYS = ['products', 'categories', 'payment-methods', 'settings'];

export const shouldPersistQuery = (queryKey: readonly unknown[]): boolean =>
  typeof queryKey[0] === 'string' && CATALOG_KEYS.includes(queryKey[0]);
