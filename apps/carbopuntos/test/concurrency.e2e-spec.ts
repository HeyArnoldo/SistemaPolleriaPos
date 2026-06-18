/**
 * E2E: Concurrencia (Fix #5 — requiere Postgres).
 *
 * Demuestra dos garantías bajo carrera real:
 *  1. Idempotencia atómica: múltiples requests con la MISMA idempotency_key
 *     no producen 500 (Postgres 23505) ni doble aplicación del saldo.
 *  2. Sin doble gasto: canjes simultáneos del mismo saldo no dejan saldo negativo
 *     ni gastan más de lo disponible.
 *
 * Este suite vive en el set e2e separado (test:e2e), que solo corre si
 * E2E_PG_URL está configurado. NO se ejecuta en `pnpm test` (unit, sin PG).
 * Para correrlo localmente, ver las instrucciones en setup-e2e.ts.
 */
import supertest from 'supertest';
import type { INestApplication } from '@nestjs/common';

import {
  closeApp,
  clearTables,
  createApp,
  hasE2eDb,
  seedSedeCredential,
  getDataSource,
} from './setup-e2e';

const SKIP = !hasE2eDb();
const SERVICE_KEY = 'test-key-concurrency';
const SEDE = 'urubamba';
const DNI = '77777777';

describe('Concurrency (e2e) — requiere Postgres', () => {
  let app: INestApplication;
  let dataSource: ReturnType<typeof getDataSource>;
  let customerId: string;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    dataSource = getDataSource();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);

    await dataSource.query(
      `INSERT INTO customers (id, dni, first_name, last_name, full_name, consent_at)
       VALUES (gen_random_uuid(), $1, 'TEST', 'CONCURRENCY', 'CONCURRENCY TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 100, 1, now())`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('accrue concurrente con la misma idempotency_key → respuesta idempotente, sin 500, sin doble aplicación', async () => {
    if (SKIP) return;

    const send = () =>
      supertest(app.getHttpServer())
        .post('/api/points/accrue')
        .set('Authorization', `Bearer ${SERVICE_KEY}`)
        .send({
          customerDni: DNI,
          points: 30,
          userRef: 'cajero1',
          idempotencyKey: 'concurrent-accrue-key',
        });

    const responses = await Promise.all([send(), send(), send(), send(), send()]);

    // Ninguna respuesta puede ser 500: la carrera de unique violation se maneja.
    for (const res of responses) {
      expect(res.status).toBe(201);
      expect(res.body.idempotencyKey).toBe('concurrent-accrue-key');
    }

    // Todas deben referenciar el MISMO movimiento (un solo insert efectivo).
    const ids = new Set(responses.map((r) => r.body.id as string));
    expect(ids.size).toBe(1);

    // El saldo se aplicó UNA sola vez: 100 + 30 = 130 (no 100 + 30*5).
    const balanceRow = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    expect(Number(balanceRow[0].balance)).toBe(130);

    // Solo existe un movimiento con esa clave.
    const movRows = await dataSource.query(
      `SELECT count(*)::int AS n FROM points_movements WHERE idempotency_key = $1`,
      ['concurrent-accrue-key'],
    );
    expect(movRows[0].n).toBe(1);
  });

  it('canjes simultáneos del mismo saldo (claves distintas) → sin doble gasto ni saldo negativo', async () => {
    if (SKIP) return;

    // Saldo actual: 130. Disparamos 5 canjes de 50 con claves distintas.
    // Solo deben prosperar los que el saldo permite (2 → 100), el resto 422.
    const redeem = (key: string) =>
      supertest(app.getHttpServer())
        .post('/api/points/redeem')
        .set('Authorization', `Bearer ${SERVICE_KEY}`)
        .send({
          customerDni: DNI,
          points: 50,
          userRef: 'cajero1',
          idempotencyKey: key,
        });

    const responses = await Promise.all([
      redeem('rdm-c-1'),
      redeem('rdm-c-2'),
      redeem('rdm-c-3'),
      redeem('rdm-c-4'),
      redeem('rdm-c-5'),
    ]);

    // No puede haber 500 por carreras: solo 201 (éxito) o 422 (saldo insuficiente).
    for (const res of responses) {
      expect([201, 422]).toContain(res.status);
    }

    const succeeded = responses.filter((r) => r.status === 201);
    // Con saldo 130 y canjes de 50, a lo sumo 2 prosperan (gasto total 100).
    expect(succeeded.length).toBeLessThanOrEqual(2);

    // El saldo final nunca es negativo y refleja exactamente los canjes aplicados.
    const balanceRow = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    const finalBalance = Number(balanceRow[0].balance);
    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(finalBalance).toBe(130 - succeeded.length * 50);
  });
});
