/**
 * Injection tokens for carbopuntos services.
 * Defined in a separate file to avoid circular imports between
 * carbopuntos.module.ts and pending-queue.service.ts.
 */
export const CARBOPUNTOS_CLIENT_TOKEN = 'CARBOPUNTOS_CLIENT';
export const CARBOPUNTOS_PENDING_TOKEN = 'CARBOPUNTOS_PENDING';
