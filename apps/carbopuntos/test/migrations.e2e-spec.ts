/**
 * E2E: Verificar que las migraciones crean el schema correcto.
 * Postergado desde WU-2 — requiere Postgres vivo.
 */
import type { INestApplication } from '@nestjs/common';

import { closeApp, createApp, hasE2eDb, getDataSource } from './setup-e2e';

const SKIP = !hasE2eDb();

describe('Migrations (e2e)', () => {
  let _app: INestApplication;
  let dataSource: ReturnType<typeof getDataSource>;

  beforeAll(async () => {
    if (SKIP) return;
    _app = await createApp();
    dataSource = getDataSource();
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  const expectedTables = [
    'customers',
    'points_balances',
    'points_movements',
    'admin_audits',
    'sede_credentials',
  ];

  for (const table of expectedTables) {
    it(`tabla "${table}" existe tras migration:run`, async () => {
      if (SKIP) return;
      const result = await dataSource.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) as "exists"`,
        [table],
      );
      expect(result[0].exists).toBe(true);
    });
  }

  it('customers.dni tiene índice UNIQUE', async () => {
    if (SKIP) return;
    const result = await dataSource.query(
      `SELECT COUNT(*) as cnt
       FROM pg_indexes
       WHERE tablename = 'customers' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%dni%'`,
    );
    expect(Number(result[0].cnt)).toBeGreaterThan(0);
  });

  it('points_balances.customer_id tiene índice UNIQUE', async () => {
    if (SKIP) return;
    const result = await dataSource.query(
      `SELECT COUNT(*) as cnt
       FROM pg_indexes
       WHERE tablename = 'points_balances' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%customer_id%'`,
    );
    expect(Number(result[0].cnt)).toBeGreaterThan(0);
  });
});
