/**
 * E2E: Canje de puntos — saldo suficiente/insuficiente, idempotencia.
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
const SERVICE_KEY = 'test-key-redeem';
const SEDE = 'calca';
const DNI = '22222222';

describe('Redeem (e2e)', () => {
  let app: INestApplication;
  let dataSource: ReturnType<typeof getDataSource>;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    dataSource = getDataSource();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);

    await dataSource.query(
      `INSERT INTO customers (id, dni, first_name, last_name, full_name, consent_at)
       VALUES (gen_random_uuid(), $1, 'TEST', 'REDEEM', 'REDEEM TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    const customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 300, 1, now())`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('POST /points/redeem — canje con saldo suficiente', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post('/api/points/redeem')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 100,
        saleRef: 'SALE-100',
        userRef: 'cajero1',
        idempotencyKey: 'idem-redeem-001',
      })
      .expect(201);

    expect(response.body.type).toBe('redeem');
    expect(response.body.balanceBefore).toBe(300);
    expect(response.body.balanceAfter).toBe(200);
    expect(response.body.points).toBe(-100);
  });

  it('POST /points/redeem — rechaza si saldo insuficiente (D6)', async () => {
    if (SKIP) return;

    await supertest(app.getHttpServer())
      .post('/api/points/redeem')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 9999,
        saleRef: 'SALE-big',
        userRef: 'cajero1',
        idempotencyKey: 'idem-redeem-fail',
      })
      .expect(422); // UnprocessableEntityException
  });
});
