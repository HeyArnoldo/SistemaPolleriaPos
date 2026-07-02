/**
 * T3.1 — UsersService assertNotSystemImmutable guard.
 * Verifies that update/deactivate on a system user (isSystem=true) throws ForbiddenException,
 * while non-system users remain fully editable.
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

describe('UsersService — system user guard (assertNotSystemImmutable)', () => {
  describe('update on a system user', () => {
    it('throws ForbiddenException when setting isActive:false (deactivation via update)', async () => {
      const service = buildService();
      const systemUser = makeUser({ isSystem: true });
      (service as any).userRepo.findOne.mockResolvedValue(systemUser);

      const dto: UpdateUserDto = { isActive: false };
      await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when changing role', async () => {
      const service = buildService();
      const systemUser = makeUser({ isSystem: true });
      (service as any).userRepo.findOne.mockResolvedValue(systemUser);

      const dto: UpdateUserDto = { role: Role.Cashier };
      await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when changing username', async () => {
      const service = buildService();
      const systemUser = makeUser({ isSystem: true });
      (service as any).userRepo.findOne.mockResolvedValue(systemUser);

      const dto: UpdateUserDto = { username: 'otro' };
      await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when changing passwordHash', async () => {
      const service = buildService();
      const systemUser = makeUser({ isSystem: true });
      (service as any).userRepo.findOne.mockResolvedValue(systemUser);

      const dto: UpdateUserDto = { passwordHash: 'newHash' };
      await expect(service.update(systemUser.id, dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivate on a system user', () => {
    it('throws ForbiddenException when deactivating the system user', async () => {
      const service = buildService();
      const systemUser = makeUser({ isSystem: true });
      (service as any).userRepo.findOne.mockResolvedValue(systemUser);

      await expect(service.deactivate(systemUser.id)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update on a non-system user', () => {
    it('succeeds with all fields when isSystem is false', async () => {
      const service = buildService();
      const normalUser = makeUser({ isSystem: false, username: 'cajero' });
      (service as any).userRepo.findOne.mockResolvedValue(normalUser);

      const dto: UpdateUserDto = {
        isActive: false,
        role: Role.Cashier,
        username: 'cajero2',
        passwordHash: 'newHash',
      };

      await expect(service.update(normalUser.id, dto)).resolves.not.toThrow();
    });
  });
});
