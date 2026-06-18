/**
 * E2E: Reversa de puntos — no-op, tope en 0.
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
const SERVICE_KEY = 'test-key-reverse';
const SEDE = 'urubamba';
const DNI = '33333333';

describe('Reverse (e2e)', () => {
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
       VALUES (gen_random_uuid(), $1, 'TEST', 'REVERSE', 'REVERSE TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 50, 1, now())`,
      [customerId],
    );
    // Insertar un movimiento de acumulación previo.
    await dataSource.query(
      `INSERT INTO points_movements
         (id, customer_id, type, points, balance_before, balance_after, sede, user_ref, sale_ref, idempotency_key, is_voided)
       VALUES (gen_random_uuid(), $1, 'accrual', 20, 30, 50, $2, 'cajero1', 'SALE-REV-1', 'idem-rev-setup', false)`,
      [customerId, SEDE],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('POST /points/reverse — reversa sobre venta sin acumulación previa → no-op pelado (C15)', async () => {
    if (SKIP) return;

    // Contrato: reverse devuelve SIEMPRE un PointsMovement "pelado" (lo que el
    // client parsea con pointsMovementSchema). El no-op es un movimiento de 0 pts.
    const response = await supertest(app.getHttpServer())
      .post('/api/points/reverse')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        saleRef: 'SALE-NO-EXISTE',
        userRef: 'cajero1',
        idempotencyKey: 'idem-rev-noop',
      })
      .expect(201);

    expect(response.body.type).toBe('reversal');
    expect(response.body.points).toBe(0);
    // Saldo intacto: balanceBefore === balanceAfter.
    expect(response.body.balanceBefore).toBe(response.body.balanceAfter);
  });

  it('POST /points/reverse — reversa válida resta puntos del saldo (movimiento pelado)', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post('/api/points/reverse')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        saleRef: 'SALE-REV-1',
        userRef: 'cajero1',
        idempotencyKey: 'idem-rev-ok',
      })
      .expect(201);

    expect(response.body.type).toBe('reversal');
    // Saldo antes era 50; se restan 20 → 30.
    expect(response.body.balanceAfter).toBe(30);
  });

  it('POST /points/reverse — reversa que excede el saldo topa en 0 (D6)', async () => {
    if (SKIP) return;

    // Acumulación grande para tener referencia de reversa que excede el saldo actual.
    await dataSource.query(
      `INSERT INTO points_movements
         (id, customer_id, type, points, balance_before, balance_after, sede, user_ref, sale_ref, idempotency_key, is_voided)
       VALUES (gen_random_uuid(), $1, 'accrual', 9999, 0, 9999, $2, 'cajero1', 'SALE-BIG', 'idem-big-accrue', false)`,
      [customerId, SEDE],
    );

    const response = await supertest(app.getHttpServer())
      .post('/api/points/reverse')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        saleRef: 'SALE-BIG',
        userRef: 'cajero1',
        idempotencyKey: 'idem-rev-tope',
      })
      .expect(201);

    // Saldo era 30 (tras reversa anterior); 9999 excede → topa en 0.
    expect(response.body.balanceAfter).toBe(0);
  });
});
