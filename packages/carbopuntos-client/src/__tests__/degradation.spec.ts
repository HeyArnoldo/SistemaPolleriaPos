/**
 * Pruebas de degradación elegante del cliente.
 *
 * Verifica que cuando el hub no está disponible (timeout, error de red, etc.),
 * se lanza CarbopuntosUnavailableError para que el caller pueda continuar la
 * operación local "sin puntos" sin bloquear la venta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { CarbopuntosClient } from '../client';
import { CarbopuntosUnavailableError, CarbopuntosApiError } from '../errors';

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

const BASE_URL = 'http://hub.test';
const SERVICE_KEY = 'test-key';

function makeClient(): CarbopuntosClient {
  return new CarbopuntosClient({ baseUrl: BASE_URL, serviceKey: SERVICE_KEY, timeout: 100 });
}

// Errores de red que deben mapearse a CarbopuntosUnavailableError
const networkErrors = [
  {
    label: 'ECONNREFUSED',
    err: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
  },
  {
    label: 'ENOTFOUND',
    err: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
  },
  { label: 'ECONNRESET', err: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) },
  { label: 'ETIMEDOUT', err: Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }) },
  {
    label: 'axios ECONNABORTED (timeout)',
    err: Object.assign(new Error('timeout exceeded'), { code: 'ECONNABORTED', isAxiosError: true }),
  },
];

describe('CarbopuntosUnavailableError — diferenciación de errores de red', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  for (const { label, err } of networkErrors) {
    it(`lanza CarbopuntosUnavailableError con ${label}`, async () => {
      const client = makeClient();
      mockAxiosInstance.get.mockRejectedValue(err);

      await expect(client.getBalance('12345678')).rejects.toBeInstanceOf(
        CarbopuntosUnavailableError,
      );
    });
  }

  it('NO lanza CarbopuntosUnavailableError para errores de negocio (4xx)', async () => {
    const client = makeClient();
    const apiErr = Object.assign(new Error('400'), {
      isAxiosError: true,
      response: { status: 400, data: { message: 'Invalid DNI' } },
    });
    mockAxiosInstance.get.mockRejectedValue(apiErr);

    const err = await client.getBalance('12345678').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CarbopuntosApiError);
    expect(err).not.toBeInstanceOf(CarbopuntosUnavailableError);
  });
});

describe('Degradación elegante — el caller puede continuar sin puntos', () => {
  let mockAxiosInstance: Partial<AxiosInstance> & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as AxiosInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('el caller puede capturar CarbopuntosUnavailableError y continuar sin bloquear la venta', async () => {
    const client = makeClient();
    const timeoutErr = Object.assign(new Error('timeout exceeded'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    mockAxiosInstance.post.mockRejectedValue(timeoutErr);

    let saleCompleted = false;
    let pointsAccrued = false;

    try {
      await client.accrue({
        customerDni: '12345678',
        points: 15,
        userRef: 'cajero-01',
        idempotencyKey: 'SALE-001:sede-1:accrual',
      });
      pointsAccrued = true;
    } catch (err) {
      if (err instanceof CarbopuntosUnavailableError) {
        // El hub no está disponible — la venta continúa sin puntos
        saleCompleted = true;
      } else {
        throw err;
      }
    }

    expect(saleCompleted).toBe(true);
    expect(pointsAccrued).toBe(false);
  });

  it('CarbopuntosUnavailableError tiene message y la causa original', async () => {
    const client = makeClient();
    const cause = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    mockAxiosInstance.get.mockRejectedValue(cause);

    const err = await client.getBalance('12345678').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CarbopuntosUnavailableError);
    expect((err as CarbopuntosUnavailableError).message).toBeTruthy();
    expect((err as CarbopuntosUnavailableError).cause).toBe(cause);
  });
});
