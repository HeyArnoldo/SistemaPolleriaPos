import { NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
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
    findAndCount: jest.fn(),
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
    it('debe enriquecer cada resultado con su saldo usando un IN de balances', async () => {
      const customers = [
        { id: 'uuid-1', fullName: 'JUAN PEREZ', dni: '11111111' },
        { id: 'uuid-2', fullName: 'JUAN GOMEZ', dni: '22222222' },
      ] as Customer[];
      customerRepo.find.mockResolvedValue(customers);
      balanceRepo.find.mockResolvedValue([
        { customerId: 'uuid-1', balance: 80 },
        { customerId: 'uuid-2', balance: 0 },
      ] as PointsBalance[]);

      const result = await service.search('juan');

      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(80);
      expect(result[1].balance).toBe(0);
      expect(balanceRepo.find).toHaveBeenCalledWith({
        where: { customerId: In(['uuid-1', 'uuid-2']) },
      });
    });

    it('debe caer a balance 0 cuando no hay registro de saldo en el resultado de búsqueda', async () => {
      const customers = [{ id: 'uuid-1', fullName: 'ANA RIOS', dni: '33333333' }] as Customer[];
      customerRepo.find.mockResolvedValue(customers);
      balanceRepo.find.mockResolvedValue([]);

      const result = await service.search('ana');

      expect(result[0].balance).toBe(0);
    });

    it('no debe consultar balances cuando la búsqueda no retorna resultados', async () => {
      customerRepo.find.mockResolvedValue([]);

      const result = await service.search('xyz');

      expect(result).toEqual([]);
      expect(balanceRepo.find).not.toHaveBeenCalled();
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('debe enriquecer cada cliente con su saldo usando un único IN para los balances', async () => {
      const customers = [
        { id: 'uuid-1', dni: '11111111' },
        { id: 'uuid-2', dni: '22222222' },
      ] as Customer[];
      (customerRepo.findAndCount as jest.Mock).mockResolvedValue([customers, 2]);
      balanceRepo.find.mockResolvedValue([
        { customerId: 'uuid-1', balance: 150 },
        { customerId: 'uuid-2', balance: 0 },
      ] as PointsBalance[]);

      const result = await service.list({ limit: 50, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.items[0].balance).toBe(150);
      expect(result.items[1].balance).toBe(0);
      // Una sola query con IN, no un OR por cada id.
      expect(balanceRepo.find).toHaveBeenCalledWith({
        where: { customerId: In(['uuid-1', 'uuid-2']) },
      });
    });

    it('debe caer a balance 0 cuando no hay registro de saldo', async () => {
      const customers = [{ id: 'uuid-1', dni: '11111111' }] as Customer[];
      (customerRepo.findAndCount as jest.Mock).mockResolvedValue([customers, 1]);
      balanceRepo.find.mockResolvedValue([]);

      const result = await service.list({ limit: 50, offset: 0 });

      expect(result.items[0].balance).toBe(0);
    });

    it('no debe consultar balances cuando la lista de clientes es vacía', async () => {
      (customerRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.list({ limit: 50, offset: 0 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(balanceRepo.find).not.toHaveBeenCalled();
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
