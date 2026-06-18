/**
 * Unit tests for CarboPuntos API service layer.
 * These test the service functions in isolation by mocking the `api` module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module before importing the service
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';
import {
  searchCustomers,
  getCustomer,
  getCustomerHistory,
  affiliateCustomer,
  adjustPoints,
  voidMovement,
} from '@/services/carbopuntos.api';
import type { Customer, PointsMovement } from '@app/carbopuntos-contracts';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const makeCustomer = (): Customer => ({
  id: 'aaaa-bbbb-cccc-dddd',
  dni: '12345678',
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez García',
  phone: '987654321',
  consentAt: '2024-01-15T10:00:00.000Z',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
});

const makeMovement = (): PointsMovement => ({
  id: 'mvmt-0001',
  customerId: 'aaaa-bbbb-cccc-dddd',
  type: 'accrual',
  points: 20,
  balanceBefore: 100,
  balanceAfter: 120,
  sede: 'sede-1',
  userRef: 'admin',
  isVoided: false,
  createdAt: '2024-01-15T10:00:00.000Z',
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── searchCustomers ──────────────────────────────────────────────────────────

describe('searchCustomers', () => {
  it('calls GET /carbopuntos/customers/search with q param', async () => {
    const customers = [makeCustomer()];
    mockApi.get.mockResolvedValue({ data: customers });

    const result = await searchCustomers('Juan');

    expect(mockApi.get).toHaveBeenCalledWith('/carbopuntos/customers/search', {
      params: { q: 'Juan' },
    });
    expect(result).toEqual(customers);
  });

  it('returns empty array when API returns empty', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    const result = await searchCustomers('xyz');
    expect(result).toEqual([]);
  });
});

// ─── getCustomer ──────────────────────────────────────────────────────────────

describe('getCustomer', () => {
  it('calls GET /carbopuntos/customers/:dni', async () => {
    const customer = makeCustomer();
    mockApi.get.mockResolvedValue({ data: customer });

    const result = await getCustomer('12345678');

    expect(mockApi.get).toHaveBeenCalledWith('/carbopuntos/customers/12345678');
    expect(result).toEqual(customer);
  });
});

// ─── getCustomerHistory ───────────────────────────────────────────────────────

describe('getCustomerHistory', () => {
  it('calls GET /carbopuntos/customers/:dni/history', async () => {
    const movements = [makeMovement()];
    mockApi.get.mockResolvedValue({ data: movements });

    const result = await getCustomerHistory('12345678');

    expect(mockApi.get).toHaveBeenCalledWith('/carbopuntos/customers/12345678/history');
    expect(result).toEqual(movements);
  });
});

// ─── affiliateCustomer ────────────────────────────────────────────────────────

describe('affiliateCustomer', () => {
  it('POSTs to /carbopuntos/customers with the payload', async () => {
    const customer = makeCustomer();
    mockApi.post.mockResolvedValue({ data: customer });
    const now = new Date().toISOString();

    const result = await affiliateCustomer({
      dni: '12345678',
      phone: '987654321',
      consentAt: now,
    });

    expect(mockApi.post).toHaveBeenCalledWith('/carbopuntos/customers', {
      dni: '12345678',
      phone: '987654321',
      consentAt: now,
    });
    expect(result).toEqual(customer);
  });

  it('sends without phone if not provided', async () => {
    const customer = makeCustomer();
    mockApi.post.mockResolvedValue({ data: customer });
    const now = new Date().toISOString();

    await affiliateCustomer({ dni: '12345678', consentAt: now });

    expect(mockApi.post).toHaveBeenCalledWith('/carbopuntos/customers', {
      dni: '12345678',
      consentAt: now,
    });
  });
});

// ─── adjustPoints ─────────────────────────────────────────────────────────────

describe('adjustPoints', () => {
  it('POSTs to /carbopuntos/customers/:dni/adjust', async () => {
    const movement = makeMovement();
    mockApi.post.mockResolvedValue({ data: movement });

    const result = await adjustPoints('12345678', {
      points: 50,
      reason: 'Test adjustment',
    });

    expect(mockApi.post).toHaveBeenCalledWith('/carbopuntos/customers/12345678/adjust', {
      points: 50,
      reason: 'Test adjustment',
    });
    expect(result).toEqual(movement);
  });
});

// ─── voidMovement ─────────────────────────────────────────────────────────────

describe('voidMovement', () => {
  it('POSTs to /carbopuntos/movements/:id/void', async () => {
    const movement = { ...makeMovement(), isVoided: true };
    mockApi.post.mockResolvedValue({ data: movement });

    const result = await voidMovement('mvmt-0001', 'Error en registro');

    expect(mockApi.post).toHaveBeenCalledWith('/carbopuntos/movements/mvmt-0001/void', {
      reason: 'Error en registro',
    });
    expect(result).toEqual(movement);
  });
});
