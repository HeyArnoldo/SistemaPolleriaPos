/**
 * Tests unitarios del AppModule del hub carbopuntos.
 * No requieren conexión real a Postgres.
 *
 * Estrategia: se mockea TypeOrmModule para evitar el intento de conexión.
 * Las variables de entorno mínimas se setean en proceso antes de importar.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

// Mock de TypeOrmModule — evita conexión a Postgres en tests unitarios.
jest.mock('@nestjs/typeorm', () => {
  const original = jest.requireActual<typeof import('@nestjs/typeorm')>('@nestjs/typeorm');
  return {
    ...original,
    TypeOrmModule: {
      ...original.TypeOrmModule,
      forRoot: jest.fn().mockReturnValue({
        module: class FakeOrmModule {},
        imports: [],
        providers: [],
        exports: [],
      }),
    },
  };
});

// Variables de entorno mínimas para que validateEnv no lance error.
beforeAll(() => {
  process.env.DB_HOST = 'localhost';
  process.env.DB_USER = 'test';
  process.env.DB_PASSWORD = 'test';
  process.env.DB_NAME = 'carbopuntos_test';
});

afterAll(() => {
  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
});

describe('AppModule', () => {
  let moduleRef: TestingModule;

  afterEach(async () => {
    if (moduleRef) await moduleRef.close();
  });

  it('debe compilar sin errores con variables de entorno mínimas', async () => {
    // Importación dinámica para que beforeAll ya haya corrido.
    const { AppModule } = await import('./app.module');
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
  });

  it('TypeOrmModule.forRoot se invoca con synchronize:false', async () => {
    const { AppModule } = await import('./app.module');
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const calls = (TypeOrmModule.forRoot as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    for (const [opts] of calls) {
      if (opts && typeof opts === 'object' && 'synchronize' in opts) {
        expect((opts as { synchronize?: boolean }).synchronize).toBe(false);
      }
    }
  });
});

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
