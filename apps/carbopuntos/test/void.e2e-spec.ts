/**
 * E2E: Anulación de movimiento (void) — soft-delete, recálculo de saldo, AdminAudit.
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
const SERVICE_KEY = 'test-key-void';
const SEDE = 'calca';
const DNI = '55555555';

describe('Void Movement (e2e)', () => {
  let app: INestApplication;
  let dataSource: ReturnType<typeof getDataSource>;
  let customerId: string;
  let movementId: string;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    dataSource = getDataSource();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);

    await dataSource.query(
      `INSERT INTO customers (id, dni, first_name, last_name, full_name, consent_at)
       VALUES (gen_random_uuid(), $1, 'TEST', 'VOID', 'VOID TEST', now())`,
      [DNI],
    );
    const rows = await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [DNI]);
    customerId = rows[0].id as string;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 80, 1, now())`,
      [customerId],
    );
    // Movimiento de acumulación (será anulado).
    await dataSource.query(
      `INSERT INTO points_movements
         (id, customer_id, type, points, balance_before, balance_after, sede, user_ref, idempotency_key, is_voided)
       VALUES (gen_random_uuid(), $1, 'accrual', 30, 50, 80, $2, 'cajero1', 'idem-void-setup', false)`,
      [customerId, SEDE],
    );
    const movRows = await dataSource.query(
      `SELECT id FROM points_movements WHERE customer_id = $1 AND is_voided = false LIMIT 1`,
      [customerId],
    );
    movementId = movRows[0].id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('POST /movements/:id/void — anula movimiento y recalcula saldo', async () => {
    if (SKIP) return;

    const response = await supertest(app.getHttpServer())
      .post(`/api/movements/${movementId}/void`)
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        movementId,
        reason: 'Error al cargar puntos',
        userRef: 'admin1',
      })
      .expect(201);

    expect(response.body.isVoided).toBe(true);
    expect(response.body.voidReason).toBe('Error al cargar puntos');

    // Verificar saldo recalculado: 80 - 30 = 50.
    const balanceRow = await dataSource.query(
      `SELECT balance FROM points_balances WHERE customer_id = $1`,
      [customerId],
    );
    expect(balanceRow[0].balance).toBe(50);
  });

  it('POST /movements/:id/void — crea entrada en AdminAudit', async () => {
    if (SKIP) return;

    const audits = await dataSource.query(
      `SELECT * FROM admin_audits WHERE action = 'void' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].reason).toBe('Error al cargar puntos');
  });

  it('POST /movements/:id/void — reintento sobre movimiento ya anulado → 409', async () => {
    if (SKIP) return;

    await supertest(app.getHttpServer())
      .post(`/api/movements/${movementId}/void`)
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .send({
        movementId,
        reason: 'Segundo intento',
        userRef: 'admin1',
      })
      .expect(409);
  });
});
