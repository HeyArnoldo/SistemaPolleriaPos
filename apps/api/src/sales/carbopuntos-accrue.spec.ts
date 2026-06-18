/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * T5.11 — SalesService.createSale() with customer_dni:
 * - Calls client.accrue with correct idempotencyKey.
 * - If CarbopuntosUnavailableError is thrown, the sale still closes and
 *   a pending entry is created in carbopuntos_pending_movement.
 * - Existing tests without customer_dni MUST NOT break.
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

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

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
  // TypeORM returns decimal columns as strings; simulate that here.
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

// ------------------------------------------------------------------
// Mock factory for manager.transaction
// ------------------------------------------------------------------

function makeManagerTransaction(savedSale: Sale, product: Product, paymentMethod: PaymentMethod) {
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

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('SalesService.createSale — carbopuntos integration', () => {
  let service: SalesService;
  let mockClient: { accrue: jest.Mock };
  let mockPendingService: { enqueue: jest.Mock };
  let mockSaleRepo: { findOne: jest.Mock; manager: { transaction: jest.Mock } };

  beforeEach(async () => {
    mockClient = { accrue: jest.fn() };
    mockPendingService = { enqueue: jest.fn() };

    const product = makeProduct(1, 5); // puntaje=5
    const paymentMethod = makePaymentMethod();
    const savedSale = makeSale(42, 'SALE-001', '12345678');

    const manager = makeManagerTransaction(savedSale, product, paymentMethod);

    mockSaleRepo = {
      findOne: jest.fn().mockResolvedValue(null), // no existing sale
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
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('calls client.accrue with correct idempotencyKey when customer_dni is provided', async () => {
    mockClient.accrue.mockResolvedValue({ id: 'mov-1' });

    await service.createSale(
      {
        saleNumber: 'SALE-001',
        customerDni: '12345678',
        items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
        payments: [{ paymentMethodId: 1, amount: 20 }],
      },
      makeUser(),
    );

    expect(mockClient.accrue).toHaveBeenCalledWith(
      expect.objectContaining({
        customerDni: '12345678',
        points: 10, // puntaje(5) × qty(2)
        idempotencyKey: expect.stringContaining('SALE-001'),
      }),
    );
  });

  it('does NOT call client.accrue when customer_dni is absent', async () => {
    const product = makeProduct(1, 5);
    const paymentMethod = makePaymentMethod();
    const savedSale = makeSale(43, 'SALE-002'); // no customerDni

    const manager = makeManagerTransaction(savedSale, product, paymentMethod);
    mockSaleRepo.manager.transaction.mockImplementation(async (fn: any) => fn(manager));

    await service.createSale(
      {
        saleNumber: 'SALE-002',
        items: [{ productId: 1, quantity: 1, unitPrice: 10 }],
        payments: [{ paymentMethodId: 1, amount: 10 }],
      },
      makeUser(),
    );

    expect(mockClient.accrue).not.toHaveBeenCalled();
    expect(mockPendingService.enqueue).not.toHaveBeenCalled();
  });

  it('does NOT call client.accrue when total points = 0 (all puntaje=0)', async () => {
    const product = makeProduct(1, 0); // puntaje=0
    const paymentMethod = makePaymentMethod();
    const savedSale = makeSale(44, 'SALE-003', '12345678');

    const manager = makeManagerTransaction(savedSale, product, paymentMethod);
    mockSaleRepo.manager.transaction.mockImplementation(async (fn: any) => fn(manager));

    await service.createSale(
      {
        saleNumber: 'SALE-003',
        customerDni: '12345678',
        items: [{ productId: 1, quantity: 3, unitPrice: 10 }],
        payments: [{ paymentMethodId: 1, amount: 30 }],
      },
      makeUser(),
    );

    expect(mockClient.accrue).not.toHaveBeenCalled();
  });

  it('enqueues pending movement and does NOT throw when hub is unavailable', async () => {
    mockClient.accrue.mockRejectedValue(
      new CarbopuntosUnavailableError('Hub no disponible', new Error('ECONNREFUSED')),
    );
    mockPendingService.enqueue.mockResolvedValue(undefined);

    // Sale must NOT throw despite hub failure
    await expect(
      service.createSale(
        {
          saleNumber: 'SALE-001',
          customerDni: '12345678',
          items: [{ productId: 1, quantity: 2, unitPrice: 10 }],
          payments: [{ paymentMethodId: 1, amount: 20 }],
        },
        makeUser(),
      ),
    ).resolves.not.toThrow();

    expect(mockPendingService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'accrue',
        customerDni: '12345678',
      }),
    );
  });
});
