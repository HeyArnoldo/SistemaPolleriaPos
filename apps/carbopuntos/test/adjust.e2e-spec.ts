/**
 * E2E: Ajuste manual de puntos — motivo obligatorio, AdminAudit, saldo negativo bloqueado.
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
const SERVICE_KEY = 'test-key-adjust';
const SEDE = 'pisac';
const DNI = '44444444';

describe('Adjust (e2e)', () => {
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
       VALUES (gen_random_uuid(), $1, 'TEST', 'ADJUST', 'ADJUST TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    const customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 200, 1, now())`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('POST /points/adjust — ajuste positivo con motivo', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post('/api/points/adjust')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 50,
        reason: 'Corrección por error en caja',
        userRef: 'admin1',
      })
      .expect(201);

    expect(response.body.type).toBe('adjustment');
    expect(response.body.balanceBefore).toBe(200);
    expect(response.body.balanceAfter).toBe(250);
  });

  it('POST /points/adjust — crea entrada en AdminAudit', async () => {
    if (SKIP) return;

    // Verificar que el AdminAudit fue creado.
    const audits = await dataSource.query(
      `SELECT * FROM admin_audits WHERE action = 'adjust' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].reason).toBe('Corrección por error en caja');
    expect(audits[0].actor_ref).toBe('admin1');
  });

  it('POST /points/adjust — ajuste que deja negativo se bloquea (D6)', async () => {
    if (SKIP) return;

    await supertest(app.getHttpServer())
      .post('/api/points/adjust')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: -999999,
        reason: 'Intento de dejar negativo',
        userRef: 'admin1',
      })
      .expect(400);
  });

  it('POST /points/adjust — sin motivo → 400 (validación Zod)', async () => {
    if (SKIP) return;

    await supertest(app.getHttpServer())
      .post('/api/points/adjust')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        customerDni: DNI,
        points: 10,
        reason: '',
        userRef: 'admin1',
      })
      .expect(400);
  });
});
