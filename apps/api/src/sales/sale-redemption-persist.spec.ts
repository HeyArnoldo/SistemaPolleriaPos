/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR1 — SaleRedemption persistence (TDD RED → GREEN)
 *
 * Rules under test:
 *
 * R1. A sale with redemptions persists SaleRedemption rows inside the same tx.
 * R2. The service response includes carbopuntos.redemptions[] (description + costPoints).
 * R3. A sale without redemptions → carbopuntos.redemptions is undefined / relation empty.
 * R4. Solo-canje (empty items) with redemptions → rows persisted, response includes them.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesService } from './services/sales.service';
import { Sale } from './entities/sale.entity';
import { SaleRedemption } from './entities/sale-redemption.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Product } from '../inventory/entities/product.entity';
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
  sale.items = [];
  sale.payments = [];
  sale.redemptions = [];
  return sale;
};

function makeManagerTransaction(
  savedSale: Sale,
  product: Product | null,
  paymentMethod: PaymentMethod | null,
  savedRedemption: SaleRedemption | null = null,
) {
  const manager = {
    create: jest.fn((Entity: any, data: any) => Object.assign(new Entity(), data)),
    save: jest.fn().mockImplementation(async (entity: any) => {
      if (entity instanceof SaleRedemption) return savedRedemption ?? entity;
      return savedSale;
    }),
    findOne: jest.fn((Entity: any, _opts: any) => {
      if (Entity === Product) return Promise.resolve(product);
      if (Entity === PaymentMethod) return Promise.resolve(paymentMethod);
      if (Entity === Sale) return Promise.resolve(savedSale);
      return Promise.resolve(null);
    }),
  };
  return manager;
}

function makeRepoManager(
  savedSale: Sale,
  product: Product | null,
  paymentMethod: PaymentMethod | null,
  savedRedemption: SaleRedemption | null = null,
) {
  return {
    transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
      fn(makeManagerTransaction(savedSale, product, paymentMethod, savedRedemption)),
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

describe('SaleRedemption — persistence and response (PR1)', () => {
  // -------------------------------------------------------------------------
  // R1 — redemptions are persisted inside the same tx
  // -------------------------------------------------------------------------
  describe('R1 — sale with redemptions inserts SaleRedemption rows in the tx', () => {
    it('calls manager.save with SaleRedemption instances for each redemption', async () => {
      const product = makeProduct(1, 5);
      const paymentMethod = makePaymentMethod();
      const savedSale = makeSale(10, 'SALE-R01', '12345678');

      const savedRedemption = new SaleRedemption();
      savedRedemption.id = 'uuid-r01';
      savedRedemption.description = 'Pollo gratis';
      savedRedemption.costPoints = 50;
      savedRedemption.quantity = 1;

      const mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn(),
        operation: jest.fn().mockResolvedValue([
          { id: 'mov-1', type: 'accrual', balanceBefore: 100, balanceAfter: 110, points: 10 },
          { id: 'mov-2', type: 'redeem', balanceBefore: 110, balanceAfter: 60 },
        ]),
        reverse: jest.fn(),
      };
      const mockPendingService = { enqueue: jest.fn() };
      const mockSaleRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        manager: makeRepoManager(savedSale, product, paymentMethod, savedRedemption),
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

      const service = module.get<SalesService>(SalesService);

      await service.createSale(
        {
          saleNumber: 'SALE-R01',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Pollo gratis', costPoints: 50 }],
        },
        makeUser(),
      );

      // Find calls to manager.save with a SaleRedemption
      const manager = (mockSaleRepo.manager.transaction as jest.Mock).mock.calls[0];
      // We need to inspect which save calls included a SaleRedemption
      // Access the manager used inside the transaction
      const txMgr = await (async () => {
        let capturedMgr: any;
        const capturingRepo = {
          findOne: jest.fn().mockResolvedValue(null),
          manager: {
            transaction: jest.fn(async (fn: any) => {
              capturedMgr = makeManagerTransaction(
                savedSale,
                product,
                paymentMethod,
                savedRedemption,
              );
              return fn(capturedMgr);
            }),
            findOne: mockSaleRepo.manager.findOne,
          },
        };

        const m2: TestingModule = await Test.createTestingModule({
          providers: [
            SalesService,
            { provide: getRepositoryToken(Sale), useValue: capturingRepo },
            { provide: CARBOPUNTOS_CLIENT_TOKEN, useValue: mockClient },
            { provide: CARBOPUNTOS_PENDING_TOKEN, useValue: mockPendingService },
            { provide: ConfigService, useValue: { get: jest.fn(() => 'SEDE-01') } },
          ],
        }).compile();

        const s2 = m2.get<SalesService>(SalesService);
        await s2.createSale(
          {
            saleNumber: 'SALE-R01-b',
            customerDni: '12345678',
            items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
            payments: [{ paymentMethodId: 1, amount: 20 }],
            redemptions: [{ description: 'Pollo gratis', costPoints: 50 }],
          },
          makeUser(),
        );

        return capturedMgr;
      })();

      // manager.create should have been called with SaleRedemption
      const createCalls = txMgr.create.mock.calls;
      const redemptionCreateCall = createCalls.find((call: any[]) => call[0] === SaleRedemption);
      expect(redemptionCreateCall).toBeDefined();

      // The created redemption should have the right shape
      const redemptionData = redemptionCreateCall![1];
      expect(redemptionData).toMatchObject({
        description: 'Pollo gratis',
        costPoints: 50,
      });
      // sale_id FK should be set explicitly (GOTCHA #6)
      expect(redemptionData.saleId).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // R2 — carbopuntos.redemptions is returned in the response
  // -------------------------------------------------------------------------
  describe('R2 — sale response includes carbopuntos.redemptions[]', () => {
    it('attaches redemptions to sale.carbopuntos in the response', async () => {
      const product = makeProduct(1, 5);
      const paymentMethod = makePaymentMethod();
      const savedSale = makeSale(11, 'SALE-R02', '12345678');
      savedSale.redemptions = [
        Object.assign(new SaleRedemption(), {
          id: 'uuid-r02',
          description: 'Postre gratis',
          costPoints: 30,
          quantity: 1,
        }),
      ];

      const mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn(),
        operation: jest.fn().mockResolvedValue([
          { id: 'mov-1', type: 'accrual', balanceBefore: 200, balanceAfter: 210, points: 10 },
          { id: 'mov-2', type: 'redeem', balanceBefore: 210, balanceAfter: 180 },
        ]),
        reverse: jest.fn(),
      };
      const mockPendingService = { enqueue: jest.fn() };
      const mockSaleRepo = {
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

      const service = module.get<SalesService>(SalesService);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R02',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Postre gratis', costPoints: 30 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos).toBeDefined();
      expect(result.carbopuntos!.redemptions).toBeDefined();
      expect(Array.isArray(result.carbopuntos!.redemptions)).toBe(true);
      expect(result.carbopuntos!.redemptions).toHaveLength(1);
      expect(result.carbopuntos!.redemptions![0]).toMatchObject({
        description: 'Postre gratis',
        costPoints: 30,
      });
    });
  });

  // -------------------------------------------------------------------------
  // R3 — sale without redemptions → no redemptions in carbopuntos
  // -------------------------------------------------------------------------
  describe('R3 — sale without redemptions → carbopuntos.redemptions absent or empty', () => {
    it('does not include redemptions when the sale has none', async () => {
      const product = makeProduct(1, 5);
      const paymentMethod = makePaymentMethod();
      const savedSale = makeSale(12, 'SALE-R03', '12345678');
      // No redemptions on the saved sale
      savedSale.redemptions = [];

      const mockClient = {
        accrue: jest.fn().mockResolvedValue({
          balanceBefore: 0,
          balanceAfter: 10,
          points: 10,
        }),
        redeem: jest.fn(),
        operation: jest.fn(),
        reverse: jest.fn(),
      };
      const mockPendingService = { enqueue: jest.fn() };
      const mockSaleRepo = {
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

      const service = module.get<SalesService>(SalesService);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R03',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
          // No redemptions
        },
        makeUser(),
      );

      // carbopuntos might exist (for accrual) but redemptions should not be set
      const redemptions = result.carbopuntos?.redemptions;
      expect(redemptions == null || (Array.isArray(redemptions) && redemptions.length === 0)).toBe(
        true,
      );
    });
  });

  // -------------------------------------------------------------------------
  // R4 — solo-canje (no items) with redemptions → rows persisted + response
  // -------------------------------------------------------------------------
  describe('R4 — solo-canje (no items) with redemptions → persisted and returned', () => {
    it('persists redemptions and returns them when sale has no items (total=0)', async () => {
      const savedSale = makeSale(13, 'SALE-R04', '12345678');
      savedSale.totalAmount = 0;
      savedSale.subtotal = 0;
      savedSale.redemptions = [
        Object.assign(new SaleRedemption(), {
          id: 'uuid-r04',
          description: 'Bebida gratis',
          costPoints: 20,
          quantity: 1,
        }),
      ];

      const mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn().mockResolvedValue({
          id: 'mov-redeem',
          balanceBefore: 50,
          points: 20,
          balanceAfter: 30,
        }),
        operation: jest.fn(),
        reverse: jest.fn(),
      };
      const mockPendingService = { enqueue: jest.fn() };
      const mockSaleRepo = {
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

      const service = module.get<SalesService>(SalesService);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R04',
          customerDni: '12345678',
          items: [],
          payments: [],
          redemptions: [{ description: 'Bebida gratis', costPoints: 20 }],
        },
        makeUser(),
      );

      // totalAmount stays 0 (D4)
      expect(result.totalAmount).toBe(0);

      // redemptions should be returned
      expect(result.carbopuntos?.redemptions).toBeDefined();
      expect(result.carbopuntos!.redemptions).toHaveLength(1);
      expect(result.carbopuntos!.redemptions![0]).toMatchObject({
        description: 'Bebida gratis',
        costPoints: 20,
      });
    });
  });
});
