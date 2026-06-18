/**
 * E2E: ServiceKeyGuard — autenticación de sedes.
 *
 * Verifica que:
 *   - Request sin Authorization → 401
 *   - Request con service key inválida → 401
 *   - Request con service key válida → acceso permitido (200)
 */
import supertest from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { closeApp, clearTables, createApp, hasE2eDb, seedSedeCredential } from './setup-e2e';

const SKIP = !hasE2eDb();
const SERVICE_KEY = 'test-key-pisac-e2e';
const SEDE = 'pisac';

describe('Auth — ServiceKeyGuard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
    await clearTables();
    await seedSedeCredential(SEDE, SERVICE_KEY);
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('request sin Authorization → 401', async () => {
    if (SKIP) return;
    await supertest(app.getHttpServer()).get('/api/customers/search?q=test').expect(401);
  });

  it('request con token inválido → 401', async () => {
    if (SKIP) return;
    await supertest(app.getHttpServer())
      .get('/api/customers/search?q=test')
      .set('Authorization', 'Bearer invalid-key-xyz')
      .expect(401);
  });

  it('request con service key válida → acceso permitido', async () => {
    if (SKIP) return;
    const response = await supertest(app.getHttpServer())
      .get('/api/customers/search?q=test')
      .set('Authorization', `Bearer ${SERVICE_KEY}`);

    // 200 (lista vacía) — no 401
    expect(response.status).toBe(200);
  });
});
