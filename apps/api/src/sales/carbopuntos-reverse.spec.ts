/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * T5.14 — SalesService.cancelSale() with customer_dni:
 * - Calls client.reverse when sale has customer_dni.
 * - If reverse fails, enqueues pending movement without throwing.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesService } from './services/sales.service';
import { Sale } from './entities/sale.entity';
import { CarbopuntosUnavailableError } from '@app/carbopuntos-client';
import {
  CARBOPUNTOS_CLIENT_TOKEN,
  CARBOPUNTOS_PENDING_TOKEN,
} from '../carbopuntos/carbopuntos.tokens';

const makeUser = () => ({ id: 1, username: 'cashier' }) as any;

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
  sale.cancelReason = null;
  sale.canceledAt = null;
  sale.canceledBy = null;
  sale.items = [];
  sale.payments = [];
  return sale;
};

describe('SalesService.cancelSale — carbopuntos integration', () => {
  let service: SalesService;
  let mockClient: { reverse: jest.Mock };
  let mockPendingService: { enqueue: jest.Mock };
  let mockSaleRepo: { findOne: jest.Mock; save: jest.Mock; manager: any };

  beforeEach(async () => {
    mockClient = { reverse: jest.fn() };
    mockPendingService = { enqueue: jest.fn() };

    const saleWithDni = makeSale(10, 'SALE-010', '12345678');

    mockSaleRepo = {
      findOne: jest.fn().mockResolvedValue(saleWithDni),
      save: jest.fn().mockImplementation((s: Sale) => Promise.resolve(s)),
      manager: { transaction: jest.fn() },
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

  it('calls client.reverse when sale has customer_dni', async () => {
    mockClient.reverse.mockResolvedValue({ id: 'mov-rev-1' });

    await service.cancelSale(10, 'Error del cliente', makeUser());

    expect(mockClient.reverse).toHaveBeenCalledWith(
      expect.objectContaining({
        customerDni: '12345678',
        saleRef: 'SALE-010',
        idempotencyKey: expect.stringContaining('SALE-010'),
      }),
    );
  });

  it('does NOT call client.reverse when sale has no customer_dni', async () => {
    const saleNoDni = makeSale(11, 'SALE-011'); // no customerDni
    mockSaleRepo.findOne.mockResolvedValue(saleNoDni);

    await service.cancelSale(11, 'Cancelado', makeUser());

    expect(mockClient.reverse).not.toHaveBeenCalled();
    expect(mockPendingService.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues pending and does NOT throw when hub is unavailable during reverse', async () => {
    mockClient.reverse.mockRejectedValue(new CarbopuntosUnavailableError('Hub no disponible'));
    mockPendingService.enqueue.mockResolvedValue(undefined);

    await expect(service.cancelSale(10, 'Cancelado', makeUser())).resolves.not.toThrow();

    expect(mockPendingService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'reverse',
        customerDni: '12345678',
        saleRef: 'SALE-010',
      }),
    );
  });
});
