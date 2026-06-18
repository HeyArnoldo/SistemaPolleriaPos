/**
 * Tests unitarios del AppModule del hub carbopuntos.
 * No requieren conexión real a Postgres.
 *
 * Los tests de compilación del módulo completo se corren en e2e (con DB real).
 * Aquí verificamos solo la configuración de TypeORM y las propiedades del DataSource.
 */

describe('dataSourceOptions', () => {
  it('synchronize debe ser false', async () => {
    const { dataSourceOptions } = await import('./config/typeorm.config');
    expect(dataSourceOptions.synchronize).toBe(false);
  });

  it('type debe ser postgres', async () => {
    const { dataSourceOptions } = await import('./config/typeorm.config');
    expect(dataSourceOptions.type).toBe('postgres');
  });

  it('entities apunta a archivos .entity.ts / .entity.js', async () => {
    const { dataSourceOptions } = await import('./config/typeorm.config');
    const entities = dataSourceOptions.entities as string[];
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.some((e) => e.includes('.entity'))).toBe(true);
  });

  it('migrations apunta al directorio database/migrations', async () => {
    const { dataSourceOptions } = await import('./config/typeorm.config');
    const migrations = dataSourceOptions.migrations as string[];
    expect(Array.isArray(migrations)).toBe(true);
    expect(migrations.some((m) => m.includes('migrations'))).toBe(true);
  });
});

describe('envSchema', () => {
  it('debe fallar si faltan variables requeridas', async () => {
    const { envSchema } = await import('./config/env.validation');
    const result = envSchema.safeParse({});
    // DB_HOST, DB_USER, DB_PASSWORD, DB_NAME son requeridos.
    expect(result.success).toBe(false);
  });

  it('debe aceptar variables mínimas requeridas', async () => {
    const { envSchema } = await import('./config/env.validation');
    const result = envSchema.safeParse({
      DB_HOST: 'localhost',
      DB_USER: 'app',
      DB_PASSWORD: 'app',
      DB_NAME: 'carbopuntos',
    });
    expect(result.success).toBe(true);
  });

  it('NODE_ENV default es development', async () => {
    const { envSchema } = await import('./config/env.validation');
    const result = envSchema.safeParse({
      DB_HOST: 'localhost',
      DB_USER: 'app',
      DB_PASSWORD: 'app',
      DB_NAME: 'carbopuntos',
    });
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });

  it('HUB_PORT default es 3100', async () => {
    const { envSchema } = await import('./config/env.validation');
    const result = envSchema.safeParse({
      DB_HOST: 'localhost',
      DB_USER: 'app',
      DB_PASSWORD: 'app',
      DB_NAME: 'carbopuntos',
    });
    if (result.success) {
      expect(result.data.HUB_PORT).toBe(3100);
    }
  });
});
