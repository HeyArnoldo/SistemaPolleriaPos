/**
 * T-TOTP-6 — UsersService.assertNotSystemImmutable: TOTP fields blocked for sistema.
 * Extends T3.1 to cover the new totpEnabled and totpSecret fields.
 */
import { ForbiddenException } from '@nestjs/common';
import { UsersService, UpdateUserDto } from './users.service';
import { User } from './user.entity';
import { Role } from '../common/enums/role.enum';

function makeUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = 1;
  user.username = 'sistema';
  user.passwordHash = 'hashed';
  user.isActive = true;
  user.isSystem = false;
  user.totpEnabled = false;
  user.totpSecret = null;
  user.role = Role.Admin;
  user.profile = { id: 1, firstName: 'Sistema', lastName: 'Support' } as any;
  return Object.assign(user, overrides);
}

function buildService(): UsersService {
  const userRepo: any = {
    findOne: jest.fn(),
    save: jest.fn((u) => Promise.resolve(u)),
  };
  const profileRepo: any = {
    save: jest.fn(),
    create: jest.fn(),
  };
  return new UsersService(userRepo, profileRepo);
}

describe('UsersService — sistema TOTP immutability (T-TOTP-6)', () => {
  it('throws ForbiddenException when setting totpEnabled on a sistema user', async () => {
    const service = buildService();
    const systemUser = makeUser({ isSystem: true });
    (service as any).userRepo.findOne.mockResolvedValue(systemUser);

    const dto: UpdateUserDto = { totpEnabled: true };
    await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when setting totpSecret on a sistema user', async () => {
    const service = buildService();
    const systemUser = makeUser({ isSystem: true });
    (service as any).userRepo.findOne.mockResolvedValue(systemUser);

    const dto: UpdateUserDto = { totpSecret: 'v1:abc:def:ghi' };
    await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when clearing totpSecret (null) on a sistema user', async () => {
    const service = buildService();
    const systemUser = makeUser({ isSystem: true, totpSecret: 'v1:abc:def:ghi' });
    (service as any).userRepo.findOne.mockResolvedValue(systemUser);

    const dto: UpdateUserDto = { totpSecret: null };
    await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
  });

  it('allows updating TOTP fields on a normal (non-sistema) user', async () => {
    const service = buildService();
    const normalUser = makeUser({ isSystem: false, username: 'cajero' });
    (service as any).userRepo.findOne.mockResolvedValue(normalUser);

    const dto: UpdateUserDto = { totpEnabled: true, totpSecret: 'v1:abc:def:ghi' };
    await expect(service.update(normalUser.id, dto)).resolves.not.toThrow();
  });
});
