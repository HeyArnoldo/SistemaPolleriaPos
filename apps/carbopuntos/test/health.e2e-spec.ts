/**
 * E2E: /health endpoint del hub carbopuntos.
 * Verifica que el entrypoint levanta correctamente contra Postgres real.
 *
 * Requiere: E2E_PG_URL configurada (ver setup-e2e.ts).
 */
import supertest from 'supertest';
import { closeApp, createApp, hasE2eDb } from './setup-e2e';
import type { INestApplication } from '@nestjs/common';

const SKIP = !hasE2eDb();

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (SKIP) return;
    app = await createApp();
  });

  afterAll(async () => {
    if (SKIP) return;
    await closeApp();
  });

  it('GET /health retorna 200 con DB conectada', async () => {
    if (SKIP) {
      console.log('[SKIP] E2E_PG_URL no configurada — saltando test e2e de health');
      return;
    }
    const response = await supertest(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
