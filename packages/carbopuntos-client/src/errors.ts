/**
 * Errores tipados del cliente Carbopuntos.
 *
 * Hay dos clases de error completamente distintas:
 *
 * - CarbopuntosUnavailableError: el hub no está alcanzable (timeout, red caída, DNS).
 *   El caller (apps/api) debe capturar este error para continuar la venta sin puntos.
 *
 * - CarbopuntosApiError: el hub respondió con un error HTTP (4xx / 5xx).
 *   Son errores de negocio (saldo insuficiente, DNI no encontrado, etc.).
 *   El caller debe manejarlos de manera diferente a los errores de red.
 */

/**
 * El hub de Carbopuntos no está disponible (timeout, error de red, DNS, etc.).
 * Cuando se captura este error, la operación puede seguir "sin puntos" sin bloquear la venta.
 */
export class CarbopuntosUnavailableError extends Error {
  override readonly name = 'CarbopuntosUnavailableError';

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message, { cause });
  }
}

/**
 * El hub respondió con un error HTTP.
 * Contiene el código de estado y el cuerpo de la respuesta para que el caller
 * pueda diferenciar, por ejemplo, saldo insuficiente (409) de DNI no encontrado (404).
 */
export class CarbopuntosApiError extends Error {
  override readonly name = 'CarbopuntosApiError';

  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: unknown,
    public override readonly cause?: unknown,
  ) {
    super(message, { cause });
  }
}
