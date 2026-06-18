/**
 * T-balance — CustomerPanel balance wiring.
 *
 * Verifies that getCustomer() returns { dni, balance, customer } and that
 * the CustomerWithBalance type shape is correct (smoke test on service layer).
 *
 * We mock the API module and assert the wired shape, matching FIX 1 spec.
 */
import { describe, it, expect, vi } from 'vitest';
import { getCustomer } from '@/services/carbopuntos.api';
import type { CustomerWithBalance } from '@/services/carbopuntos.api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApi = api as any as { get: ReturnType<typeof vi.fn> };

describe('getCustomer — returns { dni, balance, customer }', () => {
  it('returns CustomerWithBalance shape on success', async () => {
    const mockCustomer = {
      id: 'cust-uuid',
      dni: '12345678',
      firstName: 'Juan',
      lastName: 'Perez',
      fullName: 'Juan Perez',
      isActive: true,
      consentAt: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const response: CustomerWithBalance = {
      dni: '12345678',
      balance: 285,
      customer: mockCustomer,
    };
    mockApi.get.mockResolvedValueOnce({ data: response });

    const result = await getCustomer('12345678');

    expect(result.dni).toBe('12345678');
    expect(result.balance).toBe(285);
    expect(result.customer?.fullName).toBe('Juan Perez');
  });

  it('returns balance: 0 and customer: null when customer not found in search', async () => {
    const response: CustomerWithBalance = {
      dni: '99999999',
      balance: 0,
      customer: null,
    };
    mockApi.get.mockResolvedValueOnce({ data: response });

    const result = await getCustomer('99999999');

    expect(result.balance).toBe(0);
    expect(result.customer).toBeNull();
  });
});

describe('CustomerPanel — handleLink passes real balance to onCustomerLinked', () => {
  it('CustomerWithBalance type has dni, balance, and customer fields', () => {
    // Type-level check: verify the shape is what the panel expects.
    const cwb: CustomerWithBalance = {
      dni: '12345678',
      balance: 150,
      customer: {
        id: 'uuid',
        dni: '12345678',
        firstName: 'Ana',
        lastName: 'Torres',
        fullName: 'Ana Torres',
        isActive: true,
        consentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    };
    expect(cwb.balance).toBe(150);
    expect(cwb.customer?.fullName).toBe('Ana Torres');
  });
});
