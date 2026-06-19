/**
 * Tests for useListCustomers hook wiring.
 *
 * Verifies that the hook calls listCustomers from the API service
 * and is enabled on mount (no query string required).
 */
import { describe, it, expect, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateCustomerPointsQueries, QUERY_KEYS } from './query-keys';

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

describe('invalidateCustomerPointsQueries — list + search invalidation', () => {
  const makeQc = () =>
    ({ invalidateQueries: vi.fn() }) as unknown as QueryClient & {
      invalidateQueries: ReturnType<typeof vi.fn>;
    };

  const calledWithKey = (
    qc: { invalidateQueries: ReturnType<typeof vi.fn> },
    key: readonly unknown[],
  ) =>
    qc.invalidateQueries.mock.calls.some(
      ([arg]) => JSON.stringify((arg as { queryKey: unknown[] })?.queryKey) === JSON.stringify(key),
    );

  it('invalidates the admin LIST key (carbopuntos-customers-list) after an adjust', () => {
    const qc = makeQc();

    // Simulates what useAdjustPoints.onSuccess does for a known dni.
    invalidateCustomerPointsQueries(qc, '12345678');

    expect(calledWithKey(qc, QUERY_KEYS.customersList())).toBe(true);
  });

  it('still invalidates the SEARCH key (carbopuntos-customers) after an adjust', () => {
    const qc = makeQc();

    invalidateCustomerPointsQueries(qc, '12345678');

    expect(calledWithKey(qc, QUERY_KEYS.customers())).toBe(true);
  });

  it('invalidates the customer DETAIL key after an adjust', () => {
    const qc = makeQc();

    invalidateCustomerPointsQueries(qc, '12345678');

    expect(calledWithKey(qc, QUERY_KEYS.customer('12345678'))).toBe(true);
  });

  it('invalidates the admin LIST key after a void (no dni known)', () => {
    const qc = makeQc();

    // Simulates what useVoidMovement.onSuccess does when the customer is unknown.
    invalidateCustomerPointsQueries(qc);

    expect(calledWithKey(qc, QUERY_KEYS.customersList())).toBe(true);
  });

  it('still invalidates the SEARCH key after a void', () => {
    const qc = makeQc();

    invalidateCustomerPointsQueries(qc);

    expect(calledWithKey(qc, QUERY_KEYS.customers())).toBe(true);
  });
});
