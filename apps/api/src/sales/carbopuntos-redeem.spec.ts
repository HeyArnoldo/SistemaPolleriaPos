/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WU-6a — SalesService.createSale() with redemptions (TDD RED → GREEN)
 *
 * Rules under test:
 *
 * 1. Sale with customer + redemptions + accrual → calls client.operation (atomic).
 * 2. Sale with customer + redemptions only (no accrual pts) → calls client.redeem.
 * 3. Redemptions do NOT add to the monetary total (D4).
 * 4. Hub unavailable WITH redemptions → sale AND canje are REJECTED (throw). (D1/C1/C3)
 * 5. Hub 4xx WITH redemptions → sale AND canje are REJECTED (throw). (D1)
 * 6. Hub unavailable WITHOUT redemptions (accrue only) → sale still closes, movement enqueued (existing behavior).
 * 7. Cart-only canje (empty items + redemptions) → allowed when customer + redemptions present.
 * 8. Cart-only sale with no items and no redemptions → rejected (existing behavior).
 * 9. Idempotency key is included in operation/redeem calls.
 * 10. Hub rejects WITH redemptions → sale is NOT persisted (no local transaction). (D1/C1/C3)
 * 11. Hub OK WITH redemptions → operation/redeem is called BEFORE the local persist.
 * 12. Local persist fails AFTER a successful debit → compensating client.reverse is issued and the error re-thrown.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SalesService } from './services/sales.service';
import { Sale } from './entities/sale.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Product } from '../inventory/entities/product.entity';
import { CarbopuntosApiError, CarbopuntosUnavailableError } from '@app/carbopuntos-client';
import {
  CARBOPUNTOS_CLIENT_TOKEN,
  CARBOPUNTOS_PENDING_TOKEN,
} from '../carbopuntos/carbopuntos.tokens';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = () => ({ id: 1, username: 'cashier' }) as any;

const makeProduct = (id: number, puntaje: number): Product => {
  const p = new Product();
  p.id = id;
  p.name = `Product ${id}`;
  p.price = 10;
  p.puntaje = puntaje;
  p.isActive = true;
  return p;
};

const makePaymentMethod = () => {
  const pm = new PaymentMethod();
  pm.id = 1;
  pm.name = 'Efectivo';
  (pm as any).commissionPercentage = '0';
  return pm;
};

const makeSale = (id: number, saleNumber: string, customerDni?: string): Sale => {
  const sale = new Sale();
  sale.id = id;
  sale.saleNumber = saleNumber;
  sale.customerDni = customerDni ?? null;
  sale.totalAmount = 20;
  sale.subtotal = 20;
  sale.taxAmount = 0;
  sale.paymentStatus = 'paid';
  sale.isCanceled = false;
  return sale;
};

function makeManagerTransaction(
  savedSale: Sale,
  product: Product | null,
  paymentMethod: PaymentMethod | null,
) {
  const manager = {
    create: jest.fn((Entity: any, data: any) => Object.assign(new Entity(), data)),
    save: jest.fn().mockResolvedValue(savedSale),
    findOne: jest.fn((Entity: any, _opts: any) => {
      if (Entity === Product) return Promise.resolve(product);
      if (Entity === PaymentMethod) return Promise.resolve(paymentMethod);
      if (Entity === Sale) return Promise.resolve(savedSale);
      return Promise.resolve(null);
    }),
  };
  return manager;
}

/**
 * Builds the repo-level manager mock used by the canje path, which resolves
 * product puntaje BEFORE persisting (hub-first ordering). Exposes both the
 * transaction runner and a top-level findOne for that pre-persist lookup.
 */
function makeRepoManager(
  savedSale: Sale,
  product: Product | null,
  paymentMethod: PaymentMethod | null,
) {
  return {
    transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
      fn(makeManagerTransaction(savedSale, product, paymentMethod)),
    ),
    findOne: jest.fn((Entity: any, _opts: any) => {
      if (Entity === Product) return Promise.resolve(product);
      if (Entity === PaymentMethod) return Promise.resolve(paymentMethod);
      if (Entity === Sale) return Promise.resolve(savedSale);
      return Promise.resolve(null);
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SalesService.createSale — redemptions (carbopuntos)', () => {
  let service: SalesService;
  let mockClient: Record<string, jest.Mock>;
  let mockPendingService: { enqueue: jest.Mock };
  let mockSaleRepo: {
    findOne: jest.Mock;
    manager: { transaction: jest.Mock; findOne: jest.Mock };
  };

  const product = makeProduct(1, 5); // puntaje=5
  const paymentMethod = makePaymentMethod();

  const setupModule = async (savedSale: Sale) => {
    mockClient = {
      accrue: jest.fn(),
      redeem: jest.fn(),
      operation: jest.fn(),
      reverse: jest.fn(),
    };
    mockPendingService = { enqueue: jest.fn() };

    mockSaleRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      manager: makeRepoManager(savedSale, product, paymentMethod),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
        { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
        { provide: CARBOPUNTOS_PENDING_TOKEN, useValue: mockPendingService },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'SEDE-01') } },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  };

  // -----------------------------------------------------------------------
  // Test 1: mixed operation (accrue + redeem) when customer has products with pts
  // -----------------------------------------------------------------------

  describe('T1 — customer + items with puntaje + redemptions → client.operation', () => {
    it('calls client.operation with accrualPoints and redemptionPoints', async () => {
      const savedSale = makeSale(42, 'SALE-001', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockResolvedValue([{ id: 'mov-op-1' }, { id: 'mov-op-2' }]);

      await service.createSale(
        {
          saleNumber: 'SALE-001',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }], // 5*2=10 pts
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Pollo gratis', costPoints: 50 }],
        },
        makeUser(),
      );

      expect(mockClient.operation).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDni: '12345678',
          accrualPoints: 10,
          redemptionPoints: 50,
          idempotencyKey: expect.stringContaining('SALE-001'),
        }),
      );
      expect(mockClient.redeem).not.toHaveBeenCalled();
      expect(mockClient.accrue).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 2: redeem only (no accrual — all puntaje=0)
  // -----------------------------------------------------------------------

  describe('T2 — customer + zero-puntaje items + redemptions → client.redeem', () => {
    it('calls client.redeem when no points to accrue', async () => {
      const zeroPuntajeProduct = makeProduct(2, 0);
      const savedSale = makeSale(43, 'SALE-002', '12345678');

      mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn().mockResolvedValue({ id: 'mov-redeem' }),
        operation: jest.fn(),
        reverse: jest.fn(),
      };
      mockPendingService = { enqueue: jest.fn() };

      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: makeRepoManager(savedSale, zeroPuntajeProduct, paymentMethod),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
          { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
          { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
          { provide: CARBOPUNTOS_PENDING_TOKEN, useValue: mockPendingService },
          { provide: ConfigService, useValue: { get: jest.fn(() => 'SEDE-01') } },
        ],
      }).compile();

      service = module.get<SalesService>(SalesService);

      await service.createSale(
        {
          saleNumber: 'SALE-002',
          customerDni: '12345678',
          items: [{ productId: 2, quantity: 1, unitPrice: 10 }], // puntaje=0
          payments: [{ paymentMethodId: 1, amount: 10 }],
          redemptions: [{ description: 'Bebida gratis', costPoints: 30 }],
        },
        makeUser(),
      );

      expect(mockClient.redeem).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDni: '12345678',
          points: 30,
          idempotencyKey: expect.stringContaining('SALE-002'),
        }),
      );
      expect(mockClient.operation).not.toHaveBeenCalled();
      expect(mockClient.accrue).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 3: redemptions do NOT affect the monetary total (D4)
  // -----------------------------------------------------------------------

  describe('T3 — redemptions do not add to monetary total (D4)', () => {
    it('sale.totalAmount equals product subtotal only, ignoring costPoints', async () => {
      const savedSale = makeSale(44, 'SALE-003', '12345678');
      // totalAmount should be 20 (2 × 10), not 20 + 50 (costPoints)
      savedSale.totalAmount = 20;
      savedSale.subtotal = 20;
      await setupModule(savedSale);

      mockClient.operation.mockResolvedValue([{ id: 'mov-op' }]);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-003',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Premio', costPoints: 50 }],
        },
        makeUser(),
      );

      // The saved sale should have totalAmount = subtotal of items only
      expect(result.totalAmount).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // Test 4: hub unavailable WITH redemptions → REJECTS the whole operation (D1/C1/C3)
  // -----------------------------------------------------------------------

  describe('T4 — hub unavailable + redemptions → operation REJECTED, sale NOT saved (D1/C1)', () => {
    it('throws when hub is down and redemptions are present', async () => {
      const savedSale = makeSale(45, 'SALE-004', '12345678');
      await setupModule(savedSale);

      // Hub is unavailable
      mockClient.operation.mockRejectedValue(
        new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
      );
      mockClient.redeem.mockRejectedValue(
        new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
      );

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-004',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Premio', costPoints: 50 }],
          },
          makeUser(),
        ),
      ).rejects.toThrow();

      // Must NOT enqueue — redemptions never degrade silently (D1)
      expect(mockPendingService.enqueue).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 5: hub 4xx WITH redemptions → REJECTS (insufficient balance, business error)
  // -----------------------------------------------------------------------

  describe('T5 — hub 4xx + redemptions → operation REJECTED (D1)', () => {
    it('throws when hub returns 402/conflict (insufficient balance) and redemptions are present', async () => {
      const savedSale = makeSale(46, 'SALE-005', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockRejectedValue(
        new CarbopuntosApiError('Saldo insuficiente', 409, { error: 'insufficient_balance' }),
      );

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-005',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Premio grande', costPoints: 9999 }],
          },
          makeUser(),
        ),
      ).rejects.toThrow();

      expect(mockPendingService.enqueue).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 6: hub unavailable WITHOUT redemptions → sale closes, accrue enqueued (existing behavior)
  // -----------------------------------------------------------------------

  describe('T6 — hub unavailable WITHOUT redemptions → sale closes, accrue enqueued (existing behavior)', () => {
    it('does not throw and enqueues when hub is down with no redemptions', async () => {
      const savedSale = makeSale(47, 'SALE-006', '12345678');
      await setupModule(savedSale);

      mockClient.accrue.mockRejectedValue(
        new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
      );
      mockPendingService.enqueue.mockResolvedValue(undefined);

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-006',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            // No redemptions
          },
          makeUser(),
        ),
      ).resolves.not.toThrow();

      expect(mockPendingService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'accrue' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Test 7: cart-only canje (empty items + redemptions) is allowed
  // -----------------------------------------------------------------------

  describe('T7 — empty items + redemptions → allowed (F5: solo canje)', () => {
    it('accepts a sale with no items when customer + redemptions are present', async () => {
      // Cart-only canje: no products but a reward to redeem.
      // totalAmount = 0, no payments needed.
      const savedSale = makeSale(48, 'SALE-007', '12345678');
      savedSale.totalAmount = 0;
      savedSale.subtotal = 0;

      mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn().mockResolvedValue({ id: 'mov-redeem' }),
        operation: jest.fn(),
        reverse: jest.fn(),
      };
      mockPendingService = { enqueue: jest.fn() };

      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: makeRepoManager(savedSale, null, null),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
          { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
          { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
          { provide: CARBOPUNTOS_PENDING_TOKEN, useValue: mockPendingService },
          { provide: ConfigService, useValue: { get: jest.fn(() => 'SEDE-01') } },
        ],
      }).compile();

      service = module.get<SalesService>(SalesService);

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-007',
            customerDni: '12345678',
            items: [], // empty cart
            payments: [], // no payment needed
            redemptions: [{ description: 'Bebida gratis', costPoints: 20 }],
          },
          makeUser(),
        ),
      ).resolves.not.toThrow();

      expect(mockClient.redeem).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDni: '12345678',
          points: 20,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Test 8: cart-only with NO redemptions is still rejected (existing validation)
  // -----------------------------------------------------------------------

  describe('T8 — empty items + no redemptions → still rejected', () => {
    it('rejects a sale with no items and no redemptions', async () => {
      const savedSale = makeSale(49, 'SALE-008', '12345678');
      await setupModule(savedSale);

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-008',
            items: [],
            payments: [],
            // No redemptions
          },
          makeUser(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // Test 9: idempotency key is built for operation/redeem calls
  // -----------------------------------------------------------------------

  describe('T9 — idempotency key included in operation/redeem', () => {
    it('passes the STORE_ID-prefixed idempotencyKey to client.operation', async () => {
      const savedSale = makeSale(50, 'SALE-009', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockResolvedValue([{ id: 'mov-op' }]);

      await service.createSale(
        {
          saleNumber: 'SALE-009',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 1, unitPrice: 10 }], // 5 pts
          payments: [{ paymentMethodId: 1, amount: 10 }],
          redemptions: [{ description: 'Premio', costPoints: 10 }],
        },
        makeUser(),
      );

      expect(mockClient.operation).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'SEDE-01:SALE-009:operation',
        }),
      );
    });

    it('passes the STORE_ID-prefixed idempotencyKey to client.redeem', async () => {
      const zeroPuntajeProduct = makeProduct(3, 0);
      const savedSale = makeSale(51, 'SALE-010', '12345678');

      mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn().mockResolvedValue({ id: 'mov-redeem' }),
        operation: jest.fn(),
        reverse: jest.fn(),
      };
      mockPendingService = { enqueue: jest.fn() };

      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: makeRepoManager(savedSale, zeroPuntajeProduct, paymentMethod),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
          { provide: getRepositoryToken(Sale), useValue: mockSaleRepo },
          { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
          { provide: CARBOPUNTOS_PENDING_TOKEN, useValue: mockPendingService },
          { provide: ConfigService, useValue: { get: jest.fn(() => 'SEDE-01') } },
        ],
      }).compile();

      service = module.get<SalesService>(SalesService);

      await service.createSale(
        {
          saleNumber: 'SALE-010',
          customerDni: '12345678',
          items: [{ productId: 3, quantity: 1, unitPrice: 5 }],
          payments: [{ paymentMethodId: 1, amount: 5 }],
          redemptions: [{ description: 'Premio', costPoints: 15 }],
        },
        makeUser(),
      );

      expect(mockClient.redeem).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'SEDE-01:SALE-010:redeem',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Test 10: hub rejects WITH redemptions → sale is NOT persisted (D1/C1/C3)
  // -----------------------------------------------------------------------

  describe('T10 — hub rejects + redemptions → sale NOT persisted', () => {
    it('does not open the local transaction when the hub rejects the canje', async () => {
      const savedSale = makeSale(60, 'SALE-011', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockRejectedValue(
        new CarbopuntosApiError('Saldo insuficiente', 409, { error: 'insufficient_balance' }),
      );

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-011',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Premio', costPoints: 9999 }],
          },
          makeUser(),
        ),
      ).rejects.toThrow();

      // The canje requires the hub FIRST: if it fails, the sale must never reach DB.
      expect(mockSaleRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockPendingService.enqueue).not.toHaveBeenCalled();
      // No compensation needed: nothing was debited successfully and nothing was saved.
      expect(mockClient.reverse).not.toHaveBeenCalled();
    });

    it('does not open the local transaction when the hub is unavailable', async () => {
      const savedSale = makeSale(61, 'SALE-012', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockRejectedValue(
        new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
      );

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-012',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Premio', costPoints: 50 }],
          },
          makeUser(),
        ),
      ).rejects.toThrow();

      expect(mockSaleRepo.manager.transaction).not.toHaveBeenCalled();
      expect(mockPendingService.enqueue).not.toHaveBeenCalled();
      expect(mockClient.reverse).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Test 11: hub OK WITH redemptions → debit happens BEFORE the local persist
  // -----------------------------------------------------------------------

  describe('T11 — hub OK + redemptions → debit BEFORE persist', () => {
    it('calls client.operation before opening the local transaction', async () => {
      const savedSale = makeSale(62, 'SALE-013', '12345678');
      await setupModule(savedSale);

      const order: string[] = [];
      mockClient.operation.mockImplementation(async () => {
        order.push('operation');
        return [{ id: 'mov-op' }];
      });
      mockSaleRepo.manager.transaction.mockImplementation(async (fn: (m: any) => Promise<any>) => {
        order.push('transaction');
        const manager = makeManagerTransaction(savedSale, product, paymentMethod);
        return fn(manager);
      });

      await service.createSale(
        {
          saleNumber: 'SALE-013',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Premio', costPoints: 50 }],
        },
        makeUser(),
      );

      expect(order).toEqual(['operation', 'transaction']);
    });
  });

  // -----------------------------------------------------------------------
  // Test 12: local persist fails AFTER successful debit → compensating reverse
  // -----------------------------------------------------------------------

  describe('T12 — persist fails after debit → compensating reverse', () => {
    it('issues client.reverse and re-throws when the local persist fails post-debit', async () => {
      const savedSale = makeSale(63, 'SALE-014', '12345678');
      await setupModule(savedSale);

      mockClient.operation.mockResolvedValue([{ id: 'mov-op' }]);
      mockClient.reverse.mockResolvedValue({ id: 'mov-reverse' });

      // The hub debit succeeded, but the local DB write blows up afterwards.
      mockSaleRepo.manager.transaction.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.createSale(
          {
            saleNumber: 'SALE-014',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Premio', costPoints: 50 }],
          },
          makeUser(),
        ),
      ).rejects.toThrow('DB connection lost');

      // Best-effort compensation with the SAME idempotency key family for the sale.
      expect(mockClient.reverse).toHaveBeenCalledWith(
        expect.objectContaining({
          customerDni: '12345678',
          saleRef: 'SALE-014',
        }),
      );
    });
  });
});
