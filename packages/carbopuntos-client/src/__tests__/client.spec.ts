import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// Importaciones del paquete que vamos a construir.
// En fase RED estas importaciones fallarán (los módulos aún no existen).
import { CarbopuntosClient } from '../client';
import { CarbopuntosUnavailableError, CarbopuntosApiError } from '../errors';

// ---------- helpers ----------------------------------------------------------

const BASE_URL = 'http://hub.test';
const SERVICE_KEY = 'test-service-key-123';

function makeClient(overrides?: { timeout?: number }): CarbopuntosClient {
  return new CarbopuntosClient({
    baseUrl: BASE_URL,
    serviceKey: SERVICE_KEY,
    timeout: overrides?.timeout ?? 4000,
  });
}

// ---------- mocks ------------------------------------------------------------

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual,
      create: vi.fn(),
    },
  };
});

// ---------- tests ------------------------------------------------------------

describe('CarbopuntosClient — auth header', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates axios instance with Authorization Bearer header', () => {
    makeClient();
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: BASE_URL,
        headers: expect.objectContaining({
          Authorization: `Bearer ${SERVICE_KEY}`,
        }),
      }),
    );
  });

  it('includes configurable timeout in axios instance config', () => {
    makeClient({ timeout: 5000 });
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 5000,
      }),
    );
  });

  it('uses default timeout of 4000 ms when none is specified', () => {
    new CarbopuntosClient({ baseUrl: BASE_URL, serviceKey: SERVICE_KEY });
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 4000,
      }),
    );
  });
});

describe('CarbopuntosClient — getBalance', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let client: CarbopuntosClient;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
    client = makeClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a valid balance response', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        balance: 150,
        version: 3,
        updatedAt: '2026-06-17T10:00:00-05:00',
      },
    });

    const balance = await client.getBalance('12345678');

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers/12345678/balance');
    expect(balance.balance).toBe(150);
    expect(balance.customerId).toBe('550e8400-e29b-41d4-a716-446655440001');
  });

  it('valida y parsea la respuesta de balance con Zod — rejecting invalid data', async () => {
    // balance es integer en el hub (no decimal), por lo que el schema lo valida como number.
    // Si el hub devuelve datos inválidos, el cliente debe lanzar un error de validación.
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        balance: -10, // negativo — el schema rechaza saldo negativo
        version: 3,
        updatedAt: '2026-06-17T10:00:00-05:00',
      },
    });

    // El schema de contratos rechaza saldo negativo incluso cuando el hub lo devuelve
    await expect(client.getBalance('12345678')).rejects.toThrow();
  });

  it('throws CarbopuntosUnavailableError on network error', async () => {
    const networkErr = Object.assign(new Error('Network Error'), { code: 'ECONNREFUSED' });
    mockAxiosInstance.get.mockRejectedValue(networkErr);

    await expect(client.getBalance('12345678')).rejects.toBeInstanceOf(CarbopuntosUnavailableError);
  });

  it('throws CarbopuntosUnavailableError on axios timeout', async () => {
    const timeoutErr = Object.assign(new Error('timeout of 4000ms exceeded'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    mockAxiosInstance.get.mockRejectedValue(timeoutErr);

    await expect(client.getBalance('12345678')).rejects.toBeInstanceOf(CarbopuntosUnavailableError);
  });

  it('throws CarbopuntosApiError on 4xx/5xx hub responses', async () => {
    const apiErr = Object.assign(new Error('Request failed with status code 404'), {
      isAxiosError: true,
      response: {
        status: 404,
        data: { message: 'Customer not found' },
      },
    });
    mockAxiosInstance.get.mockRejectedValue(apiErr);

    await expect(client.getBalance('12345678')).rejects.toBeInstanceOf(CarbopuntosApiError);
  });
});

describe('CarbopuntosClient — accrue', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let client: CarbopuntosClient;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
    client = makeClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends idempotencyKey in the request body', async () => {
    mockAxiosInstance.post.mockResolvedValue({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        customerId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'accrual',
        points: 15,
        balanceBefore: 100,
        balanceAfter: 115,
        sede: 'sede-1',
        userRef: 'cajero-01',
        isVoided: false,
        createdAt: '2026-06-17T10:00:00-05:00',
      },
    });

    await client.accrue({
      customerDni: '12345678',
      points: 15,
      saleRef: 'SALE-001',
      userRef: 'cajero-01',
      idempotencyKey: 'SALE-001:sede-1:accrual',
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/points/accrue',
      expect.objectContaining({ idempotencyKey: 'SALE-001:sede-1:accrual' }),
    );
  });

  it('throws CarbopuntosApiError with status 409 on insufficient balance (business error)', async () => {
    const conflictErr = Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: 'Insufficient balance' },
      },
    });
    mockAxiosInstance.post.mockRejectedValue(conflictErr);

    const err = await client
      .accrue({
        customerDni: '12345678',
        points: 15,
        userRef: 'cajero-01',
        idempotencyKey: 'SALE-001:sede-1:accrual',
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CarbopuntosApiError);
    // CarbopuntosApiError es distinto de CarbopuntosUnavailableError — el caller sabe que
    // la operación fue rechazada por lógica de negocio, no por caída del hub.
    expect(err).not.toBeInstanceOf(CarbopuntosUnavailableError);
  });
});

describe('CarbopuntosClient — listCustomers', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let client: CarbopuntosClient;

  const fakeItem = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    dni: '12345678',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    phone: null,
    consentAt: '2026-06-17T10:00:00-05:00',
    isActive: true,
    createdAt: '2026-06-17T10:00:00-05:00',
    balance: 120,
  };

  beforeEach(() => {
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
    client = makeClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /customers with no params when called without args', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { items: [fakeItem], total: 1 } });

    const result = await client.listCustomers();

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers', { params: {} });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.balance).toBe(120);
  });

  it('passes limit and offset as query params', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { items: [], total: 0 } });

    await client.listCustomers({ limit: 10, offset: 20 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers', {
      params: { limit: 10, offset: 20 },
    });
  });

  it('validates the response shape with listCustomersResponseSchema', async () => {
    // Hub returns invalid shape (items missing balance) — should throw ZodError
    mockAxiosInstance.get.mockResolvedValue({
      data: { items: [{ ...fakeItem, balance: undefined }], total: 1 },
    });

    await expect(client.listCustomers()).rejects.toThrow();
  });

  it('throws CarbopuntosUnavailableError on network failure', async () => {
    const networkErr = Object.assign(new Error('Network Error'), { code: 'ECONNREFUSED' });
    mockAxiosInstance.get.mockRejectedValue(networkErr);

    await expect(client.listCustomers()).rejects.toBeInstanceOf(CarbopuntosUnavailableError);
  });
});

describe('CarbopuntosClient — lookupOrAffiliate', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let client: CarbopuntosClient;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
    client = makeClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the customer record on success', async () => {
    const customerData = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      dni: '12345678',
      firstName: 'Juan',
      lastName: 'Pérez',
      fullName: 'Juan Pérez García',
      phone: null,
      consentAt: '2026-06-17T10:00:00-05:00',
      isActive: true,
      createdAt: '2026-06-17T10:00:00-05:00',
    };
    mockAxiosInstance.post.mockResolvedValue({ data: customerData });

    const result = await client.lookupOrAffiliate({
      dni: '12345678',
      consentAt: '2026-06-17T10:00:00-05:00',
    });

    expect(result.dni).toBe('12345678');
    expect(result.fullName).toBe('Juan Pérez García');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/customers',
      expect.objectContaining({ dni: '12345678' }),
    );
  });
});

describe('CarbopuntosClient — search (with balance)', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let client: CarbopuntosClient;

  const fakeSearchItem = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    dni: '12345678',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez García',
    phone: null,
    consentAt: '2026-06-17T10:00:00-05:00',
    isActive: true,
    createdAt: '2026-06-17T10:00:00-05:00',
    balance: 80,
  };

  beforeEach(() => {
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
    client = makeClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /customers/search with q params', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [fakeSearchItem] });

    const result = await client.search({ q: 'juan' });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/customers/search', {
      params: expect.objectContaining({ q: 'juan' }),
    });
    expect(result).toHaveLength(1);
  });

  it('each result item includes a balance field', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [fakeSearchItem] });

    const result = await client.search({ q: 'juan' });

    expect(result[0]?.balance).toBe(80);
  });

  it('validates response shape — rejects items without balance', async () => {
    const itemWithoutBalance = { ...fakeSearchItem };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (itemWithoutBalance as any).balance;
    mockAxiosInstance.get.mockResolvedValue({ data: [itemWithoutBalance] });

    await expect(client.search({ q: 'juan' })).rejects.toThrow();
  });

  it('returns empty array when search yields no results', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [] });

    const result = await client.search({ q: 'xyz' });

    expect(result).toEqual([]);
  });
});
