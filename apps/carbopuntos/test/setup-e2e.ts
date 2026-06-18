/**
 * Helper para tests e2e del hub carbopuntos.
 *
 * Levanta la aplicación NestJS contra la DB de test, corre las migraciones
 * y retorna la aplicación NestJS para supertest.
 *
 * REQUIERE: variable de entorno E2E_PG_URL con la URL de Postgres.
 * Si no está configurada, los tests se saltean automáticamente.
 *
 * Cómo correr localmente:
 *   docker run --rm -d --name cp-hub-test \
 *     -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=carbopuntos_test \
 *     -p 55433:5432 postgres:16-alpine
 *   E2E_PG_URL=postgresql://app:app@localhost:55433/carbopuntos_test \
 *     pnpm --filter @app/carbopuntos test:e2e
 *   docker stop cp-hub-test
 */
import 'reflect-metadata';

export const E2E_PG_URL = process.env['E2E_PG_URL'];

/** Retorna true si la variable E2E_PG_URL está configurada. */
export function hasE2eDb(): boolean {
  return !!E2E_PG_URL;
}

// Singleton — compartido entre todos los archivos e2e que corren con --runInBand.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appInstance: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dataSourceInstance: any;
let initialized = false;

/**
 * Crea la aplicación NestJS con la DB de test (singleton).
 * Las variables de entorno se configuran antes de importar el AppModule.
 *
 * El módulo se crea solo la primera vez; llamadas subsecuentes retornan el mismo.
 */
export async function createApp(): Promise<import('@nestjs/common').INestApplication> {
  if (initialized && appInstance) return appInstance as import('@nestjs/common').INestApplication;

  // IMPORTANTE: configurar env ANTES de importar AppModule para evitar que
  // validateEnv falle en el module-level import.
  const url = new URL(E2E_PG_URL!);
  process.env['DB_HOST'] = url.hostname;
  process.env['DB_PORT'] = url.port || '5432';
  process.env['DB_USER'] = url.username;
  process.env['DB_PASSWORD'] = decodeURIComponent(url.password);
  process.env['DB_NAME'] = url.pathname.slice(1);
  process.env['HUB_PORT'] = '13100';

  // Importación dinámica para que las vars de entorno ya estén configuradas.
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const { DataSource } = await import('typeorm');

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  appInstance = moduleFixture.createNestApplication();
  appInstance.setGlobalPrefix('api', { exclude: ['health'] });
  await appInstance.init();

  dataSourceInstance = appInstance.get(DataSource);
  // Corre migraciones en la DB de test (solo una vez).
  await dataSourceInstance.runMigrations({ transaction: 'each' });

  initialized = true;
  return appInstance;
}

/** Limpia todas las tablas entre tests. */
export async function clearTables(): Promise<void> {
  if (!dataSourceInstance) return;
  await dataSourceInstance.query(`TRUNCATE TABLE
    admin_audits,
    points_movements,
    points_balances,
    customers,
    sede_credentials
    RESTART IDENTITY CASCADE`);
}

/** Cierra la aplicación y la conexión (llamar solo en el afterAll del último suite). */
export async function closeApp(): Promise<void> {
  if (appInstance) {
    await appInstance.close();
    appInstance = undefined;
    dataSourceInstance = undefined;
    initialized = false;
  }
}

/**
 * Retorna el DataSource activo (para queries directas en tests).
 */
export function getDataSource(): import('typeorm').DataSource {
  return dataSourceInstance as import('typeorm').DataSource;
}

/**
 * Inserta una credencial de sede para tests de autenticación.
 * Usa bcryptjs.hashSync con bcrypt_rounds=4 para rapidez en tests.
 */
export async function seedSedeCredential(sede: string, serviceKey: string): Promise<void> {
  if (!dataSourceInstance) throw new Error('DB no inicializada — llama createApp() primero');
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync(serviceKey, 4);
  await dataSourceInstance.query(
    `INSERT INTO sede_credentials (id, sede, service_key_hash, is_active)
     VALUES (gen_random_uuid(), $1, $2, true)
     ON CONFLICT (sede) DO UPDATE SET service_key_hash = EXCLUDED.service_key_hash`,
    [sede, hash],
  );
}
