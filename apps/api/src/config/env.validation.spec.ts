/**
 * env.validation — Carbopuntos hub / STORE_ID cross-field rule (D15).
 *
 * STORE_ID es opcional, pero es clave para la unicidad de la idempotencyKey
 * entre sedes. Cuando CARBOPUNTOS_HUB_URL está configurado, STORE_ID pasa a ser
 * obligatorio: sin él, dos sedes podrían generar la misma key y el hub
 * doble-aplicaría operaciones.
 */
import { validateEnv } from './env.validation';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_USER: 'user',
  DB_PASSWORD: 'pass',
  DB_NAME: 'db',
  JWT_SECRET: 'a-very-long-secret-key',
};

describe('validateEnv — Carbopuntos STORE_ID rule', () => {
  it('passes when the hub is NOT configured and STORE_ID is absent', () => {
    expect(() => validateEnv({ ...baseEnv })).not.toThrow();
  });

  it('passes when the hub is configured AND STORE_ID is present', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        CARBOPUNTOS_HUB_URL: 'https://hub.example.com',
        STORE_ID: 'SEDE-01',
      }),
    ).not.toThrow();
  });

  it('fails when the hub is configured but STORE_ID is missing', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        CARBOPUNTOS_HUB_URL: 'https://hub.example.com',
      }),
    ).toThrow(/STORE_ID/);
  });

  it('does NOT require STORE_ID when CARBOPUNTOS_HUB_URL is an empty string', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        CARBOPUNTOS_HUB_URL: '',
      }),
    ).not.toThrow();
  });
});
