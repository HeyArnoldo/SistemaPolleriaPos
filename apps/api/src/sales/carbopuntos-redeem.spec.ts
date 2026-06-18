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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SalesService.createSale — redemptions (carbopuntos)', () => {
  let service: SalesService;
  let mockClient: Record<string, jest.Mock>;
  let mockPendingService: { enqueue: jest.Mock };
  let mockSaleRepo: { findOne: jest.Mock; manager: { transaction: jest.Mock } };

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

    const manager = makeManagerTransaction(savedSale, product, paymentMethod);

    mockSaleRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      manager: {
        transaction: jest.fn(async (fn: (m: any) => Promise<any>) => fn(manager)),
      },
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

      const manager = makeManagerTransaction(savedSale, zeroPuntajeProduct, paymentMethod);
      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: {
          transaction: jest.fn(async (fn: (m: any) => Promise<any>) => fn(manager)),
        },
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

      const manager = makeManagerTransaction(savedSale, null, null);
      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: {
          transaction: jest.fn(async (fn: (m: any) => Promise<any>) => fn(manager)),
        },
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

      const manager = makeManagerTransaction(savedSale, zeroPuntajeProduct, paymentMethod);
      mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: {
          transaction: jest.fn(async (fn: (m: any) => Promise<any>) => fn(manager)),
        },
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
});
