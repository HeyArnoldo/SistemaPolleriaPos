import { CarbopuntosApiError, CarbopuntosUnavailableError } from '@app/carbopuntos-client';

/**
 * Decide si un error del hub de Carbopuntos amerita reintento (D16).
 *
 * Son reintentables:
 * - CarbopuntosUnavailableError: el hub no respondió (timeout, red caída, DNS).
 * - CarbopuntosApiError con status >= 500: el hub respondió con un 5xx
 *   transitorio (502/503/500). Reintentar puede funcionar más tarde.
 *
 * NO son reintentables (permanentes):
 * - CarbopuntosApiError con status 4xx (saldo insuficiente, DNI no encontrado,
 *   validación): reintentar nunca lo arregla. Hay que loguear y descartar.
 *
 * El cliente mapea TODO status >= 400 a CarbopuntosApiError, así que la única
 * forma de distinguir un 5xx transitorio de un 4xx de negocio es por el status.
 */
export function isRetryableHubError(err: unknown): boolean {
  return (
    err instanceof CarbopuntosUnavailableError ||
    (err instanceof CarbopuntosApiError && err.status >= 500)
  );
}
