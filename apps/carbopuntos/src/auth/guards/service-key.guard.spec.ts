import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ServiceKeyGuard } from './service-key.guard';
import { SedeCredential } from '../entities/sede-credential.entity';
import { Repository } from 'typeorm';

// Mock bcryptjs para evitar hashing real en tests unitarios.
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

function makeContext(authHeader?: string): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (authHeader !== undefined) {
    req['headers'] = { authorization: authHeader };
  } else {
    req['headers'] = {};
  }
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceKeyGuard', () => {
  let guard: ServiceKeyGuard;
  let repo: jest.Mocked<Repository<SedeCredential>>;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<SedeCredential>>;
    guard = new ServiceKeyGuard(repo);
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('debe lanzar UnauthorizedException si no hay header Authorization', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el header no empieza con Bearer', async () => {
    const ctx = makeContext('Basic abc123');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el token está vacío', async () => {
    const ctx = makeContext('Bearer ');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si ninguna credencial activa coincide', async () => {
    repo.find.mockResolvedValue([
      { id: '1', sede: 'urubamba', serviceKeyHash: '$2b$12$hash1', isActive: true },
    ] as SedeCredential[]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const ctx = makeContext('Bearer invalid-key');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe inyectar req.sede y retornar true con un service key válido', async () => {
    const credential: SedeCredential = {
      id: '1',
      sede: 'pisac',
      serviceKeyHash: '$2b$12$valid-hash',
      isActive: true,
    };
    repo.find.mockResolvedValue([credential]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req: Record<string, unknown> = { headers: { authorization: 'Bearer valid-key' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req['sede']).toBe('pisac');
  });

  it('debe ignorar credenciales inactivas (find con where isActive:true retorna vacío)', async () => {
    // El guard consulta find({ where: { isActive: true } }) — la DB ya filtra inactivos.
    // El mock refleja ese comportamiento: retorna lista vacía para credenciales inactivas.
    repo.find.mockResolvedValue([]);

    const ctx = makeContext('Bearer any-key');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
