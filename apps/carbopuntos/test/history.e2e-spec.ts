/**
 * E2E: Historial cross-sede de movimientos (D25).
 * Verifica que GET /customers/:dni/history retorna movimientos de todas las sedes.
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
const SERVICE_KEY = 'test-key-history';
const SEDE = 'pisac';
const DNI = '77777777';

describe('History cross-sede (e2e)', () => {
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
       VALUES (gen_random_uuid(), $1, 'TEST', 'HISTORY', 'HISTORY TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 200, 1, now())`,
      [customerId],
    );

    // Movimientos de distintas sedes.
    await dataSource.query(
      `INSERT INTO points_movements
         (id, customer_id, type, points, balance_before, balance_after, sede, user_ref, idempotency_key, is_voided)
       VALUES
         (gen_random_uuid(), $1, 'accrual', 100, 0, 100, 'pisac', 'cajero1', 'h-mov-1', false),
         (gen_random_uuid(), $1, 'accrual', 100, 100, 200, 'urubamba', 'cajero2', 'h-mov-2', false)`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('GET /customers/:dni/history — retorna movimientos de todas las sedes (cross-sede)', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .get(`/api/customers/${DNI}/history`)
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);

    const sedes = response.body.map((m: { sede: string }) => m.sede) as string[];
    expect(sedes).toContain('pisac');
    expect(sedes).toContain('urubamba');
  });
});
