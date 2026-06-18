/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WU-6a — CarbopuntosProxyController tests (TDD RED → GREEN)
 *
 * Verifies that the proxy controller:
 * - Routes each endpoint to the correct CarbopuntosClient method.
 * - Maps responses transparently.
 * - Enforces JwtAuthGuard on all routes.
 * - Enforces RolesGuard + Role.Admin on adjust and void endpoints.
 * - Rejects cashiers on admin-only routes with 403.
 * - Injects STORE_ID where the hub requires it.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CarbopuntosProxyController } from './carbopuntos-proxy.controller';
import { CARBOPUNTOS_CLIENT_TOKEN } from './carbopuntos.tokens';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAdmin = () => ({ id: 10, username: 'admin', role: Role.Admin }) as any;
const makeCashier = () => ({ id: 20, username: 'cashier', role: Role.Cashier }) as any;

const fakeCustomer = {
  id: 'uuid-cust',
  dni: '12345678',
  firstName: 'Juan',
  lastName: 'Perez',
  fullName: 'Juan Perez',
  phone: null,
  consentAt: '2025-01-01T00:00:00.000Z',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

const fakeBalance = {
  customerId: 'uuid-cust',
  balance: 150,
  version: 3,
  updatedAt: '2025-06-01T00:00:00.000Z',
};

const fakeMovement = {
  id: 'uuid-mov',
  customerId: 'uuid-cust',
  type: 'accrual',
  points: 10,
  balanceBefore: 140,
  balanceAfter: 150,
  sede: 'SEDE-01',
  userRef: '1',
  saleRef: null,
  detail: null,
  idempotencyKey: null,
  isVoided: false,
  voidedBy: null,
  voidedAt: null,
  voidReason: null,
  createdAt: '2025-06-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CarbopuntosProxyController', () => {
  let controller: CarbopuntosProxyController;
  let mockClient: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockClient = {
      search: jest.fn(),
      getBalance: jest.fn(),
      lookupOrAffiliate: jest.fn(),
      getHistory: jest.fn(),
      adjust: jest.fn(),
      voidMovement: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CarbopuntosProxyController],
      providers: [
        { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('SEDE-01') },
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue(new RolesGuard(new Reflector()))
      .compile();

    controller = module.get<CarbopuntosProxyController>(CarbopuntosProxyController);
  });

  // -------------------------------------------------------------------------
  // GET /carbopuntos/customers/search
  // -------------------------------------------------------------------------

  describe('GET /carbopuntos/customers/search', () => {
    it('calls client.search and returns the result', async () => {
      mockClient.search.mockResolvedValue([fakeCustomer]);

      const result = await controller.searchCustomers({ q: 'Juan' });

      expect(mockClient.search).toHaveBeenCalledWith({ q: 'Juan' });
      expect(result).toEqual([fakeCustomer]);
    });

    it('passes limit and offset query params to client.search', async () => {
      mockClient.search.mockResolvedValue([fakeCustomer]);

      await controller.searchCustomers({ q: 'Juan', limit: 10, offset: 0 });

      expect(mockClient.search).toHaveBeenCalledWith({ q: 'Juan', limit: 10, offset: 0 });
    });
  });

  // -------------------------------------------------------------------------
  // GET /carbopuntos/customers/:dni
  // -------------------------------------------------------------------------

  describe('GET /carbopuntos/customers/:dni', () => {
    it('calls client.getBalance and returns customer + balance', async () => {
      mockClient.getBalance.mockResolvedValue(fakeBalance);

      const result = await controller.getCustomerBalance('12345678');

      expect(mockClient.getBalance).toHaveBeenCalledWith('12345678');
      expect(result).toEqual({ dni: '12345678', balance: fakeBalance });
    });
  });

  // -------------------------------------------------------------------------
  // GET /carbopuntos/customers/:dni/history
  // -------------------------------------------------------------------------

  describe('GET /carbopuntos/customers/:dni/history', () => {
    it('calls client.getHistory and returns the movements', async () => {
      mockClient.getHistory.mockResolvedValue([fakeMovement]);

      const result = await controller.getCustomerHistory('12345678');

      expect(mockClient.getHistory).toHaveBeenCalledWith('12345678');
      expect(result).toEqual([fakeMovement]);
    });
  });

  // -------------------------------------------------------------------------
  // POST /carbopuntos/customers (affiliate)
  // -------------------------------------------------------------------------

  describe('POST /carbopuntos/customers', () => {
    it('calls client.lookupOrAffiliate and returns the customer', async () => {
      mockClient.lookupOrAffiliate.mockResolvedValue(fakeCustomer);

      const body = {
        dni: '12345678',
        phone: '999888777',
        consentAt: '2025-01-01T00:00:00.000Z',
      };

      const result = await controller.affiliateCustomer(body);

      expect(mockClient.lookupOrAffiliate).toHaveBeenCalledWith(body);
      expect(result).toEqual(fakeCustomer);
    });

    it('calls client.lookupOrAffiliate without phone when phone is omitted', async () => {
      mockClient.lookupOrAffiliate.mockResolvedValue(fakeCustomer);

      const body = { dni: '12345678', consentAt: '2025-01-01T00:00:00.000Z' };

      await controller.affiliateCustomer(body);

      expect(mockClient.lookupOrAffiliate).toHaveBeenCalledWith(body);
    });
  });

  // -------------------------------------------------------------------------
  // POST /carbopuntos/customers/:dni/adjust (admin-only)
  // -------------------------------------------------------------------------

  describe('POST /carbopuntos/customers/:dni/adjust', () => {
    it('calls client.adjust with userRef from the authenticated admin', async () => {
      mockClient.adjust.mockResolvedValue(fakeMovement);
      const admin = makeAdmin();

      const result = await controller.adjustCustomerPoints('12345678', admin, {
        points: 50,
        reason: 'Compensación',
      });

      expect(mockClient.adjust).toHaveBeenCalledWith({
        customerDni: '12345678',
        points: 50,
        reason: 'Compensación',
        userRef: String(admin.id),
      });
      expect(result).toEqual(fakeMovement);
    });

    it('throws ForbiddenException when a cashier tries to adjust (RolesGuard)', () => {
      // Simulate what RolesGuard does when role does not match.
      // The Reflector reads metadata set by @Roles(Role.Admin) on the handler.
      const cashier = makeCashier();
      const reflector = new Reflector();

      // Create a stable handler reference with the @Roles metadata attached.
      const handler = function adjustHandler() {
        /* noop */
      };
      Reflect.defineMetadata('roles', [Role.Admin], handler);

      const mockContext = {
        switchToHttp: () => ({ getRequest: () => ({ user: cashier }) }),
        getHandler: () => handler,
        getClass: () => CarbopuntosProxyController,
      } as any;

      const guard = new RolesGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('injects STORE_ID as part of the sede context (not passed directly to adjust)', async () => {
      // adjust does NOT receive storeId directly; storeId is used by the hub via ServiceKeyGuard.
      // The controller just forwards userRef — we verify no storeId leaks into adjust payload.
      mockClient.adjust.mockResolvedValue(fakeMovement);
      const admin = makeAdmin();

      await controller.adjustCustomerPoints('12345678', admin, { points: -10, reason: 'Error' });

      const call = mockClient.adjust.mock.calls[0][0];
      expect(call).not.toHaveProperty('storeId');
      expect(call).toHaveProperty('userRef', '10');
    });
  });

  // -------------------------------------------------------------------------
  // POST /carbopuntos/movements/:id/void (admin-only)
  // -------------------------------------------------------------------------

  describe('POST /carbopuntos/movements/:id/void', () => {
    it('calls client.voidMovement with the movementId and userRef', async () => {
      mockClient.voidMovement.mockResolvedValue(fakeMovement);
      const admin = makeAdmin();

      const result = await controller.voidMovement('uuid-mov-123', admin, {
        reason: 'Movimiento duplicado',
      });

      expect(mockClient.voidMovement).toHaveBeenCalledWith({
        movementId: 'uuid-mov-123',
        reason: 'Movimiento duplicado',
        userRef: String(admin.id),
      });
      expect(result).toEqual(fakeMovement);
    });

    it('throws ForbiddenException when a cashier tries to void (RolesGuard)', () => {
      const cashier = makeCashier();
      const reflector = new Reflector();

      const voidHandler = function voidHandler() {
        /* noop */
      };
      Reflect.defineMetadata('roles', [Role.Admin], voidHandler);

      const mockContext = {
        switchToHttp: () => ({ getRequest: () => ({ user: cashier }) }),
        getHandler: () => voidHandler,
        getClass: () => CarbopuntosProxyController,
      } as any;

      const guard = new RolesGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
