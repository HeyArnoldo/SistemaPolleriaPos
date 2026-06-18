/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * T6.13 (api side) — SalesService attaches `carbopuntos` transient result to the sale.
 *
 * Rules under test:
 * 1. Online accrue → carbopuntos.pointsEarned set from local calc, pointsBefore/After from
 *    movement.balanceBefore/balanceAfter, pending: false.
 * 2. Enqueued accrue (hub down) → carbopuntos.pointsEarned set locally, pending: true,
 *    no pointsBefore/After.
 * 3. Sale with no customer → carbopuntos is undefined/null (field absent).
 * 4. Online operation (mixed) → pointsBefore/After from accrual movement, pointsEarned
 *    from accrual movement, pointsRedeemed from redemption movement, pending: false.
 * 5. Online redeem-only → pointsRedeemed from movement, pointsBefore/After from movement,
 *    pending: false.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesService } from './services/sales.service';
import { Sale } from './entities/sale.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Product } from '../inventory/entities/product.entity';
import { CarbopuntosUnavailableError } from '@app/carbopuntos-client';
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

function makeManagerTransaction(savedSale: Sale, product: Product, paymentMethod: PaymentMethod) {
  return {
    create: jest.fn((Entity: any, data: any) => Object.assign(new Entity(), data)),
    save: jest.fn().mockResolvedValue(savedSale),
    findOne: jest.fn((Entity: any) => {
      if (Entity === Product) return Promise.resolve(product);
      if (Entity === PaymentMethod) return Promise.resolve(paymentMethod);
      if (Entity === Sale) return Promise.resolve(savedSale);
      return Promise.resolve(null);
    }),
  };
}

function makeRepoManager(
  savedSale: Sale,
  product: Product | null,
  paymentMethod: PaymentMethod | null,
) {
  return {
    transaction: jest.fn(async (fn: (m: any) => Promise<any>) =>
      fn(makeManagerTransaction(savedSale, product as any, paymentMethod as any)),
    ),
    findOne: jest.fn((Entity: any) => {
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

describe('SalesService — carbopuntos transient result on sale', () => {
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

  // -------------------------------------------------------------------------
  // T1: online accrual → carbopuntos with real before/after, pending: false
  // -------------------------------------------------------------------------

  describe('T1 — online accrual → carbopuntos populated, pending: false', () => {
    it('attaches carbopuntos with pointsBefore/After from hub movement', async () => {
      const savedSale = makeSale(1, 'SALE-R1', '12345678');
      await setupModule(savedSale);

      // Hub returns movement with balanceBefore=100, balanceAfter=110, points=10
      mockClient.accrue.mockResolvedValue({
        id: 'mov-1',
        customerId: 'cust-uuid',
        type: 'accrual',
        points: 10,
        balanceBefore: 100,
        balanceAfter: 110,
        sede: 'SEDE-01',
        userRef: '1',
        saleRef: 'SALE-R1',
        idempotencyKey: 'SEDE-01:SALE-R1:accrual',
        isVoided: false,
        createdAt: new Date().toISOString(),
      });

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R1',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }], // puntaje 5×2=10
          payments: [{ paymentMethodId: 1, amount: 20 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos).toBeDefined();
      expect(result.carbopuntos).toMatchObject({
        pointsBefore: 100,
        pointsEarned: 10,
        pointsAfter: 110,
        pending: false,
      });
      expect(result.carbopuntos?.pointsRedeemed).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // T2: hub down (enqueued) → pending: true, no before/after
  // -------------------------------------------------------------------------

  describe('T2 — hub unavailable (enqueued) → pending: true, no before/after', () => {
    it('attaches carbopuntos with pointsEarned and pending: true when hub is down', async () => {
      const savedSale = makeSale(2, 'SALE-R2', '12345678');
      await setupModule(savedSale);

      mockClient.accrue.mockRejectedValue(
        new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
      );
      mockPendingService.enqueue.mockResolvedValue(undefined);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R2',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }], // puntaje 5×2=10
          payments: [{ paymentMethodId: 1, amount: 20 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos).toBeDefined();
      expect(result.carbopuntos).toMatchObject({
        pointsEarned: 10,
        pending: true,
      });
      expect(result.carbopuntos?.pointsBefore).toBeUndefined();
      expect(result.carbopuntos?.pointsAfter).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // T3: no customer → carbopuntos absent
  // -------------------------------------------------------------------------

  describe('T3 — no customer → carbopuntos absent', () => {
    it('does not attach carbopuntos when sale has no customer', async () => {
      const savedSale = makeSale(3, 'SALE-R3'); // no customerDni
      await setupModule(savedSale);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R3',
          items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 10 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos == null).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // T4: online mixed operation → pointsBefore/After from accrual movement
  // -------------------------------------------------------------------------

  describe('T4 — mixed operation → pointsBefore/After from hub movements', () => {
    it('attaches carbopuntos from operation movements (accrual + redemption)', async () => {
      const savedSale = makeSale(4, 'SALE-R4', '12345678');
      await setupModule(savedSale);

      // operation returns [accrualMovement, redemptionMovement]
      const accrualMov = {
        id: 'mov-acc',
        customerId: 'cust-uuid',
        type: 'accrual',
        points: 10,
        balanceBefore: 200,
        balanceAfter: 160, // 200 + 10 - 50
        sede: 'SEDE-01',
        userRef: '1',
        saleRef: 'SALE-R4',
        idempotencyKey: 'SEDE-01:SALE-R4:operation',
        isVoided: false,
        createdAt: new Date().toISOString(),
      };
      const redeemMov = {
        id: 'mov-red',
        customerId: 'cust-uuid',
        type: 'redeem',
        points: 50,
        balanceBefore: 200,
        balanceAfter: 160,
        sede: 'SEDE-01',
        userRef: '1',
        saleRef: 'SALE-R4',
        idempotencyKey: 'SEDE-01:SALE-R4:operation',
        isVoided: false,
        createdAt: new Date().toISOString(),
      };
      mockClient.operation.mockResolvedValue([accrualMov, redeemMov]);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R4',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }], // 10 pts
          payments: [{ paymentMethodId: 1, amount: 20 }],
          redemptions: [{ description: 'Premio', costPoints: 50 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos).toMatchObject({
        pointsBefore: 200,
        pointsEarned: 10,
        pointsRedeemed: 50,
        pointsAfter: 160,
        pending: false,
      });
    });
  });

  // -------------------------------------------------------------------------
  // T5: online redeem-only → pointsRedeemed/Before/After from movement
  // -------------------------------------------------------------------------

  describe('T5 — redeem-only → carbopuntos from redeem movement', () => {
    it('attaches carbopuntos with pointsRedeemed from hub movement', async () => {
      const zeroPuntajeProduct = makeProduct(2, 0);
      const savedSale = makeSale(5, 'SALE-R5', '12345678');

      mockClient = {
        accrue: jest.fn(),
        redeem: jest.fn(),
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

      const redeemMov = {
        id: 'mov-red',
        customerId: 'cust-uuid',
        type: 'redeem',
        points: 30,
        balanceBefore: 150,
        balanceAfter: 120,
        sede: 'SEDE-01',
        userRef: '1',
        saleRef: 'SALE-R5',
        idempotencyKey: 'SEDE-01:SALE-R5:redeem',
        isVoided: false,
        createdAt: new Date().toISOString(),
      };
      mockClient.redeem.mockResolvedValue(redeemMov);

      const result = await service.createSale(
        {
          saleNumber: 'SALE-R5',
          customerDni: '12345678',
          items: [{ productId: 2, quantity: 1, unitPrice: 10 }], // puntaje=0
          payments: [{ paymentMethodId: 1, amount: 10 }],
          redemptions: [{ description: 'Bebida gratis', costPoints: 30 }],
        },
        makeUser(),
      );

      expect(result.carbopuntos).toMatchObject({
        pointsBefore: 150,
        pointsRedeemed: 30,
        pointsAfter: 120,
        pending: false,
      });
      expect(result.carbopuntos?.pointsEarned).toBeUndefined();
    });
  });
});
