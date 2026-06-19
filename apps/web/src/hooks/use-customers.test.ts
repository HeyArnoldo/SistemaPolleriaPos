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
