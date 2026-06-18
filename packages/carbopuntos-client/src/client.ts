import axios, { isAxiosError } from 'axios';
import type { AxiosInstance } from 'axios';
import {
  // Contratos de entrada
  affiliateCustomerSchema,
  customerSearchSchema,
  accrueSchema,
  redeemSchema,
  mixedOperationSchema,
  reverseSchema,
  adjustSchema,
  voidMovementSchema,
  // Contratos de salida
  customerSchema,
  balanceSchema,
  pointsMovementSchema,
} from '@app/carbopuntos-contracts';
import type {
  AffiliateCustomerInput,
  CustomerSearchInput,
  AccrueInput,
  RedeemInput,
  MixedOperationInput,
  ReverseInput,
  AdjustInput,
  VoidMovementInput,
  Customer,
  Balance,
  PointsMovement,
} from '@app/carbopuntos-contracts';
import { z } from 'zod';
import { CarbopuntosApiError, CarbopuntosUnavailableError } from './errors';

// Códigos de error de red que indican que el hub no está alcanzable.
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNABORTED', // axios timeout
  'ERR_NETWORK',
]);

/** Configuración de CarbopuntosClient. */
export interface CarbopuntosClientConfig {
  /** URL base del hub, ej. https://hub.carbopuntos.example.com */
  baseUrl: string;
  /** Service key de la sede (CARBOPUNTOS_SERVICE_KEY). */
  serviceKey: string;
  /** Timeout en ms. Default: 4000. */
  timeout?: number;
}

/** Schema para lista de movimientos (paginada). */
const movementListSchema = z.array(pointsMovementSchema);

/** Schema para lista de clientes. */
const customerListSchema = z.array(customerSchema);

/**
 * Cliente HTTP tipado para comunicación sede→hub.
 *
 * Encapsula autenticación, timeouts y degradación elegante: los errores de red
 * se lanzan como CarbopuntosUnavailableError para que apps/api pueda continuar
 * la venta sin puntos sin bloquear la operación financiera local.
 */
export class CarbopuntosClient {
  private readonly http: AxiosInstance;

  constructor(config: CarbopuntosClientConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 4000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.serviceKey}`,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Métodos de clientes
  // -------------------------------------------------------------------------

  /**
   * Busca un cliente por DNI o lo afilia si no existe.
   * Llama POST /customers con los datos de afiliación.
   */
  async lookupOrAffiliate(input: AffiliateCustomerInput): Promise<Customer> {
    const body = affiliateCustomerSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/customers', body));
    return customerSchema.parse(data);
  }

  /**
   * Obtiene el saldo actual de un cliente por DNI.
   * Llama GET /customers/:dni/balance
   */
  async getBalance(dni: string): Promise<Balance> {
    const { data } = await this.request(() =>
      this.http.get<unknown>(`/customers/${encodeURIComponent(dni)}/balance`),
    );
    return balanceSchema.parse(data);
  }

  /**
   * Busca clientes por nombre o DNI parcial.
   * Llama GET /customers/search?q=...
   */
  async search(input: CustomerSearchInput): Promise<Customer[]> {
    const params = customerSearchSchema.parse(input);
    const { data } = await this.request(() =>
      this.http.get<unknown>('/customers/search', { params }),
    );
    return customerListSchema.parse(data);
  }

  /**
   * Obtiene el historial de movimientos de un cliente.
   * Llama GET /customers/:dni/history
   */
  async getHistory(dni: string): Promise<PointsMovement[]> {
    const { data } = await this.request(() =>
      this.http.get<unknown>(`/customers/${encodeURIComponent(dni)}/history`),
    );
    return movementListSchema.parse(data);
  }

  // -------------------------------------------------------------------------
  // Métodos de operaciones de puntos
  // -------------------------------------------------------------------------

  /**
   * Acumula puntos para un cliente tras una venta.
   * Requiere idempotencyKey para evitar duplicados en reintentos.
   */
  async accrue(input: AccrueInput): Promise<PointsMovement> {
    const body = accrueSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/points/accrue', body));
    return pointsMovementSchema.parse(data);
  }

  /**
   * Canjea puntos de un cliente por un premio.
   * Requiere idempotencyKey para evitar doble canje en reintentos.
   */
  async redeem(input: RedeemInput): Promise<PointsMovement> {
    const body = redeemSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/points/redeem', body));
    return pointsMovementSchema.parse(data);
  }

  /**
   * Operación mixta atómica: acumulación + canje en una sola transacción.
   * Requiere idempotencyKey.
   */
  async operation(input: MixedOperationInput): Promise<PointsMovement[]> {
    const body = mixedOperationSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/points/operation', body));
    return movementListSchema.parse(data);
  }

  /**
   * Revierte los puntos acumulados en una venta (ej. al cancelar la venta).
   * Requiere idempotencyKey. No-op si no hubo acumulación previa (C15).
   */
  async reverse(input: ReverseInput): Promise<PointsMovement> {
    const body = reverseSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/points/reverse', body));
    return pointsMovementSchema.parse(data);
  }

  /**
   * Ajuste manual de saldo realizado por un admin.
   * No requiere idempotencyKey. Requiere motivo obligatorio (D8).
   */
  async adjust(input: AdjustInput): Promise<PointsMovement> {
    const body = adjustSchema.parse(input);
    const { data } = await this.request(() => this.http.post<unknown>('/points/adjust', body));
    return pointsMovementSchema.parse(data);
  }

  /**
   * Anula (soft-delete) un movimiento existente.
   * Desencadena recálculo de saldo en el hub.
   */
  async voidMovement(input: VoidMovementInput): Promise<PointsMovement> {
    const body = voidMovementSchema.parse(input);
    const { data } = await this.request(() =>
      this.http.post<unknown>(`/movements/${body.movementId}/void`, body),
    );
    return pointsMovementSchema.parse(data);
  }

  // -------------------------------------------------------------------------
  // Manejo centralizado de errores
  // -------------------------------------------------------------------------

  /**
   * Envuelve cualquier llamada HTTP mapeando los errores a los tipos correctos:
   * - Error de red / timeout → CarbopuntosUnavailableError (el hub no responde)
   * - Respuesta HTTP con status ≥ 400 → CarbopuntosApiError (error de negocio)
   */
  private async request<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        // Axios error con response: el hub respondió con un status de error
        if (err.response) {
          throw new CarbopuntosApiError(err.message, err.response.status, err.response.data, err);
        }

        // Axios error sin response: timeout o error de red
        if (err.code !== undefined && NETWORK_ERROR_CODES.has(err.code)) {
          throw new CarbopuntosUnavailableError(
            `Hub no disponible (${err.code}): ${err.message}`,
            err,
          );
        }

        // Otro error de axios sin response ni código reconocido → también indisponible
        throw new CarbopuntosUnavailableError(`Hub no disponible: ${err.message}`, err);
      }

      // Error genérico de red (sin isAxiosError), ej. ECONNREFUSED nativo
      if (err instanceof Error && 'code' in err) {
        const code = (err as Error & { code?: string }).code;
        if (code !== undefined && NETWORK_ERROR_CODES.has(code)) {
          throw new CarbopuntosUnavailableError(`Hub no disponible (${code}): ${err.message}`, err);
        }
      }

      throw err;
    }
  }
}
