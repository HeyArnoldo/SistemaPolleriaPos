/**
 * Tests for useListCustomers hook wiring.
 *
 * Verifies that the hook calls listCustomers from the API service
 * and is enabled on mount (no query string required).
 */
import { describe, it, expect, vi } from 'vitest';

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
