import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CustomersService } from './customers.service';
import { Customer } from '../entities/customer.entity';
import { DniService, DniLookupResult } from './dni.service';
import { PointsMovement } from '../../points/entities/points-movement.entity';
import { PointsBalance } from '../../points/entities/points-balance.entity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRepo<T extends Record<string, any>>(): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  } as unknown as jest.Mocked<Repository<T>>;
}

const mockDniResult: DniLookupResult = {
  dni: '12345678',
  firstName: 'JUAN',
  lastName: 'PEREZ GARCIA',
  fullName: 'PEREZ GARCIA, JUAN',
};

describe('CustomersService', () => {
  let service: CustomersService;
  let customerRepo: jest.Mocked<Repository<Customer>>;
  let movementRepo: jest.Mocked<Repository<PointsMovement>>;
  let balanceRepo: jest.Mocked<Repository<PointsBalance>>;
  let dniService: jest.Mocked<DniService>;

  beforeEach(() => {
    customerRepo = makeRepo<Customer>();
    movementRepo = makeRepo<PointsMovement>();
    balanceRepo = makeRepo<PointsBalance>();
    dniService = { lookup: jest.fn() } as unknown as jest.Mocked<DniService>;

    service = new CustomersService(customerRepo, movementRepo, balanceRepo, dniService);
  });

  // ── affiliate ─────────────────────────────────────────────────────────────

  describe('affiliate', () => {
    it('debe retornar el cliente existente si el DNI ya está afiliado', async () => {
      const existing = { id: 'uuid-1', dni: '12345678' } as Customer;
      customerRepo.findOne.mockResolvedValue(existing);

      const result = await service.affiliate({
        dni: '12345678',
        consentAt: new Date().toISOString(),
      });

      expect(result).toBe(existing);
      expect(dniService.lookup).not.toHaveBeenCalled();
    });

    it('debe crear un cliente nuevo si el DNI no existe — usando json.pe', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      dniService.lookup.mockResolvedValue(mockDniResult);

      const created = { id: 'uuid-2', dni: '12345678' } as Customer;
      const savedBalance = { id: 'bal-1', customerId: 'uuid-2', balance: 0 } as PointsBalance;

      // Simula la transacción.
      (customerRepo.manager.transaction as jest.Mock).mockImplementation(
        async (fn: (m: unknown) => Promise<Customer>) => {
          const mgr = {
            create: jest.fn().mockImplementation((_, data) => ({ ...data })),
            save: jest
              .fn()
              .mockImplementationOnce(() => Promise.resolve(created))
              .mockImplementationOnce(() => Promise.resolve(savedBalance)),
          };
          return fn(mgr);
        },
      );

      const result = await service.affiliate({
        dni: '12345678',
        phone: '999888777',
        consentAt: new Date().toISOString(),
      });

      expect(dniService.lookup).toHaveBeenCalledWith('12345678');
      expect(result).toBe(created);
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('debe buscar clientes por nombre o DNI parcial', async () => {
      const customers = [{ id: 'uuid-1', fullName: 'JUAN PEREZ' }] as Customer[];
      customerRepo.find.mockResolvedValue(customers);

      const result = await service.search('juan');

      expect(result).toBe(customers);
      expect(customerRepo.find).toHaveBeenCalled();
    });
  });

  // ── findByDni ─────────────────────────────────────────────────────────────

  describe('findByDni', () => {
    it('debe retornar el cliente con su saldo', async () => {
      const customer = { id: 'uuid-1', dni: '12345678' } as Customer;
      const balance = { customerId: 'uuid-1', balance: 150 } as PointsBalance;
      customerRepo.findOne.mockResolvedValue(customer);
      balanceRepo.findOne.mockResolvedValue(balance);

      const result = await service.findByDni('12345678');

      expect(result.customer).toBe(customer);
      expect(result.balance).toBe(balance);
    });

    it('debe lanzar NotFoundException si el DNI no existe', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.findByDni('99999999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('debe retornar todos los movimientos del cliente cross-sede ordenados por fecha', async () => {
      const customer = { id: 'uuid-1', dni: '12345678' } as Customer;
      customerRepo.findOne.mockResolvedValue(customer);
      const movements = [
        { id: 'm1', sede: 'pisac', createdAt: new Date() },
        { id: 'm2', sede: 'urubamba', createdAt: new Date() },
      ] as PointsMovement[];
      movementRepo.find.mockResolvedValue(movements);

      const result = await service.getHistory('12345678');

      expect(result).toBe(movements);
      expect(movementRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'uuid-1' } }),
      );
    });

    it('debe lanzar NotFoundException si el cliente no existe', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.getHistory('99999999')).rejects.toThrow(NotFoundException);
    });
  });
});
