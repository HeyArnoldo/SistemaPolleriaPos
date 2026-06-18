/**
 * E2E: Clientes del hub.
 *
 * Para afiliar sin API key real se usa un cliente pre-insertado directamente en DB.
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
const SERVICE_KEY = 'test-key-urubamba-customers';
const SEDE = 'urubamba';
const TEST_DNI = '27427864';

describe('Customers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    const dataSource = getDataSource();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);

    await dataSource.query(
      `INSERT INTO customers (id, dni, first_name, last_name, full_name, phone, consent_at, is_active)
       VALUES (gen_random_uuid(), $1, 'JOSE PEDRO', 'CASTILLO TERRONES', 'CASTILLO TERRONES, JOSE PEDRO', null, now(), true)`,
      [TEST_DNI],
    );
    const row = (await dataSource.query(`SELECT id FROM customers WHERE dni = $1`, [
      TEST_DNI,
    ])) as Array<{ id: string }>;
    const customerId = row[0].id;
    await dataSource.query(
      `INSERT INTO points_balances (id, customer_id, balance, version, updated_at)
       VALUES (gen_random_uuid(), $1, 150, 1, now())`,
      [customerId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('GET /customers/search?q=CASTILLO retorna lista no vacia', async () => {
    if (SKIP) return;
    const response = await supertest(app.getHttpServer())
      .get('/api/customers/search?q=CASTILLO')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].dni).toBe(TEST_DNI);
  });

  it('GET /customers/:dni retorna el cliente con su saldo', async () => {
    if (SKIP) return;
    const response = await supertest(app.getHttpServer())
      .get(`/api/customers/${TEST_DNI}`)
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .expect(200);

    expect(response.body.dni).toBe(TEST_DNI);
    expect(response.body.balance).toBe(150);
  });

  it('GET /customers/:dni/balance retorna solo el saldo', async () => {
    if (SKIP) return;
    const response = await supertest(app.getHttpServer())
      .get(`/api/customers/${TEST_DNI}/balance`)
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .expect(200);

    expect(response.body.balance).toBe(150);
    expect(response.body.customerId).toBeDefined();
  });

  it('GET /customers/:dni no existente 404', async () => {
    if (SKIP) return;
    await supertest(app.getHttpServer())
      .get('/api/customers/99999999')
      .set('Authorization', `Bearer ${SERVICE_KEY}`)
      .expect(404);
  });
});
