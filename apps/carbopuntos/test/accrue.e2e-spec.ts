/**
 * E2E: Acumulación de puntos — idempotencia y saldo correcto.
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
const SERVICE_KEY = 'test-key-accrue';
const SEDE = 'pisac';
const DNI = '11111111';

describe('Accrue (e2e)', () => {
  let app: INestApplication;
  let dataSource: ReturnType<typeof getDataSource>;
  let customerId: string;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    dataSource = getDataSource();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);

    // Insertar cliente con saldo inicial 100.
    await dataSource.query(
      `INSERT INTO customers (id, dni, first_name, last_name, full_name, consent_at)
       VALUES (gen_random_uuid(), $1, 'TEST', 'ACCRUE', 'ACCRUE TEST', now())`,
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

  it('POST /points/accrue — acumula puntos correctamente', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post('/api/points/accrue')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 20,
        saleRef: 'SALE-001',
        userRef: 'cajero1',
        idempotencyKey: 'idem-accrue-001',
      })
      .expect(201);

    expect(response.body.type).toBe('accrual');
    expect(response.body.balanceBefore).toBe(100);
    expect(response.body.balanceAfter).toBe(120);
    expect(response.body.sede).toBe(SEDE);
  });

  it('POST /points/accrue — reintento con misma idempotencyKey retorna movimiento original (sin duplicado)', async () => {
    if (SKIP) return;

    // Primer request.
    await supertest(app.getHttpServer())
      .post('/api/points/accrue')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 15,
        saleRef: 'SALE-002',
        userRef: 'cajero1',
        idempotencyKey: 'idem-accrue-002',
      })
      .expect(201);

    // Segundo request con la misma clave — debe retornar el mismo movimiento.
    const response2 = await supertest(app.getHttpServer())
      .post('/api/points/accrue')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 15,
        saleRef: 'SALE-002',
        userRef: 'cajero1',
        idempotencyKey: 'idem-accrue-002',
      })
      .expect(201);

    // Verificar que no se duplicaron los puntos.
    const balanceRow = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    const balance = balanceRow[0].balance as number;
    // Saldo = 100 (inicial) + 20 (primer accrue) + 15 (segundo accrue, una sola vez) = 135
    expect(balance).toBe(135);
    expect(response2.body.type).toBe('accrual');
  });
});
