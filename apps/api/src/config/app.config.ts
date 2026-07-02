import type { CookieOptions } from 'express';

/** Nombre de la cookie httpOnly de sesión. */
export const SESSION_COOKIE = 'app_session';

/** Convierte '7d' / '12h' / '30m' / '3600' (s) en milisegundos para maxAge. */
export function expiresToMs(value: string): number {
  const m = /^(\d+)([dhms])?$/.exec(value.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1] ?? '7', 10);
  const unit = m[2] ?? 's';
  const mult = { d: 86400, h: 3600, m: 60, s: 1 }[unit] ?? 1;
  return n * mult * 1000;
}

/** Default TTL para el token de challenge 2FA cuando el valor es inválido/ausente. */
export const CHALLENGE_EXPIRES_DEFAULT_MS = 5 * 60 * 1000; // 5m
/** Cota máxima dura del TTL del challenge 2FA. */
export const CHALLENGE_EXPIRES_MAX_MS = 15 * 60 * 1000; // 15m

/**
 * TTL en ms para el token de challenge 2FA (CP-12), con política FAIL-CLOSED.
 *
 * A diferencia de expiresToMs (que hace fallback al default de sesión de 7 días
 * ante un valor no parseable), el challenge DEBE ser corto: un valor malformado
 * o ausente cae al default corto (5m) y un valor demasiado grande se recorta al
 * máximo (15m). Nunca puede acuñar un token de challenge de 7 días.
 */
export function challengeExpiresToMs(value: string | undefined): number {
  if (value === undefined) return CHALLENGE_EXPIRES_DEFAULT_MS;
  const m = /^(\d+)([dhms])?$/.exec(value.trim());
  if (!m) return CHALLENGE_EXPIRES_DEFAULT_MS;
  const n = parseInt(m[1] ?? '5', 10);
  const unit = m[2] ?? 's';
  const mult = { d: 86400, h: 3600, m: 60, s: 1 }[unit] ?? 1;
  const ms = n * mult * 1000;
  // Clamp: un valor sobredimensionado falla CERRADO a la ventana corta máxima.
  return Math.min(ms, CHALLENGE_EXPIRES_MAX_MS);
}

/**
 * Opciones de la cookie de sesión. En producción detrás de Traefik/Coolify:
 * COOKIE_SECURE=true (y main.ts ya setea trust proxy). Para compartir entre
 * subdominios: COOKIE_DOMAIN=.tudominio.com. Dominios distintos: SAMESITE=none.
 */
export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ?? 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: expiresToMs(process.env.JWT_EXPIRES_IN ?? '7d'),
  };
}
