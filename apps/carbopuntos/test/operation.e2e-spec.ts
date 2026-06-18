/**
 * E2E: Operación mixta atómica (acumulación + canje).
 * Si el canje falla (saldo insuficiente), la acumulación tampoco se aplica.
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
const SERVICE_KEY = 'test-key-operation';
const SEDE = 'urubamba';
const DNI = '66666666';

describe('Operation mixta (e2e)', () => {
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
       VALUES (gen_random_uuid(), $1, 'TEST', 'OPERATION', 'OPERATION TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 250, 1, now())`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('POST /points/operation — operación mixta atómica exitosa', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post('/api/points/operation')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        accrualPoints: 15,
        redemptionPoints: 100,
        saleRef: 'SALE-MIX-1',
        userRef: 'cajero1',
        idempotencyKey: 'idem-op-001',
      })
      .expect(201);

    // Debe retornar un array con los movimientos creados.
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].type).toBe('accrual');
    expect(response.body[1].type).toBe('redeem');

    // Saldo final: 250 + 15 - 100 = 165
    const balanceRow = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    expect(balanceRow[0].balance).toBe(165);
  });

  it('POST /points/operation — si el canje falla, la acumulación no se aplica (atomicidad)', async () => {
    if (SKIP) return;

    // Saldo actual: 165. Intentar canjear 9999 → falla.
    const balanceBefore = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    const balanceBeforeValue = balanceBefore[0].balance as number;

    await supertest(app.getHttpServer())
      .post('/api/points/operation')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        accrualPoints: 10,
        redemptionPoints: 9999,
        saleRef: 'SALE-MIX-FAIL',
        userRef: 'cajero1',
        idempotencyKey: 'idem-op-fail',
      })
      .expect(422);

    // El saldo no debe haber cambiado (la tx se revirtió).
    const balanceAfter = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    expect(balanceAfter[0].balance).toBe(balanceBeforeValue);
  });
});
