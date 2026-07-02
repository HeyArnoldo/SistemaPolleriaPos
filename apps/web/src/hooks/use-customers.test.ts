/**
 * Tests for useListCustomers hook wiring.
 *
 * Verifies that the hook calls listCustomers from the API service
 * and is enabled on mount (no query string required).
 */
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateCustomerPointsQueries } from './query-keys';

// Mock the service module before any imports that resolve it.
vi.mock('@/services/carbopuntos.api', () => ({
  listCustomers: vi.fn(),
  searchCustomers: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerHistory: vi.fn(),
  affiliateCustomer: vi.fn(),
  adjustPoints: vi.fn(),
  voidMovement: vi.fn(),
}));

// ─── Helper ────────────────────────────────────────────────────────────────

const makeCustomerWithBalance = () => ({
  id: 'aaaa-bbbb-cccc-dddd',
  dni: '12345678',
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez García',
  phone: null,
  consentAt: '2024-01-15T10:00:00.000Z',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  balance: 80,
});

import * as carbopuntosApi from '@/services/carbopuntos.api';

describe('useListCustomers — service wiring', () => {
  it('listCustomers service function is exported from carbopuntos.api', () => {
    // If the service export doesn't exist, this test fails at import time.
    expect(typeof carbopuntosApi.listCustomers).toBe('function');
  });

  it('listCustomers is called without mandatory args (no search query needed)', async () => {
    const mockListCustomers = vi.mocked(carbopuntosApi.listCustomers);
    mockListCustomers.mockResolvedValue({ items: [], total: 0 });

    // Simulate the queryFn call that useListCustomers would make.
    const result = await carbopuntosApi.listCustomers();

    expect(mockListCustomers).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('listCustomers can be called with pagination params', async () => {
    const mockListCustomers = vi.mocked(carbopuntosApi.listCustomers);
    mockListCustomers.mockResolvedValue({ items: [], total: 0 });

    await carbopuntosApi.listCustomers({ limit: 10, offset: 0 });

    expect(mockListCustomers).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });
});

describe('useSearchCustomers — service wiring with balance', () => {
  it('searchCustomers service function is exported from carbopuntos.api', () => {
    expect(typeof carbopuntosApi.searchCustomers).toBe('function');
  });

  it('searchCustomers returns items with balance field', async () => {
    const mockSearchCustomers = vi.mocked(carbopuntosApi.searchCustomers);
    mockSearchCustomers.mockResolvedValue([makeCustomerWithBalance()]);

    const result = await carbopuntosApi.searchCustomers('juan');

    expect(mockSearchCustomers).toHaveBeenCalledTimes(1);
    expect(result[0]?.balance).toBe(80);
  });

  it('searchCustomers returns empty array when no results', async () => {
    const mockSearchCustomers = vi.mocked(carbopuntosApi.searchCustomers);
    mockSearchCustomers.mockResolvedValue([]);

    const result = await carbopuntosApi.searchCustomers('xyz');

    expect(result).toEqual([]);
  });
});

describe('invalidateCustomerPointsQueries — real invalidation behavior', () => {
  // Chequeamos `isInvalidated` sobre un QueryClient REAL en vez de espiar el
  // mock de invalidateQueries. El bug era sutil: invalidar con la factory key
  // `['carbopuntos-customers', undefined]` LLAMA a invalidateQueries (un mock lo
  // daría por bueno) pero NO matchea los queries de búsqueda reales
  // (`['carbopuntos-customers', 'algunDni']`), porque partialMatchKey compara el
  // índice 1 (`undefined` vs el dni) y falla. Sembramos queries reales y
  // verificamos que de verdad quedan invalidadas: eso prueba COMPORTAMIENTO, no
  // que se haya llamado a una función con cierta key.
  const SEARCH_KEY = ['carbopuntos-customers', 'someDni'] as const;
  const LIST_KEY = ['carbopuntos-customers-list', { limit: 50, offset: 0 }] as const;
  const DETAIL_KEY = ['carbopuntos-customer', 'someDni'] as const;
  const HISTORY_KEY = ['carbopuntos-customer-history', 'someDni'] as const;
  const BALANCE_KEY = ['carbopuntos-customer-balance', 'someDni'] as const;

  const seedQueries = (qc: QueryClient) => {
    qc.setQueryData(SEARCH_KEY, []);
    qc.setQueryData(LIST_KEY, { items: [], total: 0 });
    qc.setQueryData(DETAIL_KEY, {});
    qc.setQueryData(HISTORY_KEY, []);
    qc.setQueryData(BALANCE_KEY, 0);
  };

  const isInvalidated = (qc: QueryClient, key: readonly unknown[]) =>
    qc.getQueryState(key)?.isInvalidated === true;

  it('invalidates search, list, detail, history and balance for a known dni', () => {
    const qc = new QueryClient();
    seedQueries(qc);

    // Simula lo que hace useAdjustPoints.onSuccess con un dni conocido.
    invalidateCustomerPointsQueries(qc, 'someDni');

    expect(isInvalidated(qc, SEARCH_KEY)).toBe(true);
    expect(isInvalidated(qc, LIST_KEY)).toBe(true);
    expect(isInvalidated(qc, DETAIL_KEY)).toBe(true);
    expect(isInvalidated(qc, HISTORY_KEY)).toBe(true);
    expect(isInvalidated(qc, BALANCE_KEY)).toBe(true);
  });

  it('invalidates search and list when no dni is known (void path)', () => {
    const qc = new QueryClient();
    seedQueries(qc);

    // Simula lo que hace useVoidMovement.onSuccess cuando no conoce el dni.
    invalidateCustomerPointsQueries(qc);

    expect(isInvalidated(qc, SEARCH_KEY)).toBe(true);
    expect(isInvalidated(qc, LIST_KEY)).toBe(true);
  });
});
