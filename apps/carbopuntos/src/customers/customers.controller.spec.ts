import { NotFoundException } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './services/customers.service';
import { Customer } from './entities/customer.entity';
import { PointsBalance } from '../points/entities/points-balance.entity';

function makeCustomer(): Customer {
  return {
    id: 'a1b2',
    dni: '12345678',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    phone: null,
    consentAt: new Date('2026-01-01T00:00:00.000Z'),
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Customer;
}

function makeBalance(): PointsBalance {
  return {
    id: 'bal-1',
    customerId: 'a1b2',
    balance: 120,
    version: 3,
    updatedAt: new Date('2026-06-17T10:00:00.000Z'),
  } as PointsBalance;
}

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: { findByDni: jest.Mock; list: jest.Mock; search: jest.Mock };

  beforeEach(() => {
    service = { findByDni: jest.fn(), list: jest.fn(), search: jest.fn() };
    controller = new CustomersController(service as unknown as CustomersService);
  });

  // ── GET /customers (list) ────────────────────────────────────────────────

  describe('list', () => {
    it('calls service.list with default params when no query is passed', async () => {
      const listResult = {
        items: [{ ...makeCustomer(), balance: 120 }],
        total: 1,
      };
      service.list.mockResolvedValue(listResult);

      const result = await controller.list({ limit: 50, offset: 0 }, 'pisac');

      expect(service.list).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(result).toEqual(listResult);
    });

    it('passes explicit limit/offset to service.list', async () => {
      service.list.mockResolvedValue({ items: [], total: 0 });

      await controller.list({ limit: 10, offset: 20 }, 'pisac');

      expect(service.list).toHaveBeenCalledWith({ limit: 10, offset: 20 });
    });

    it('returns { items, total } structure', async () => {
      service.list.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list({ limit: 50, offset: 0 }, 'pisac');

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
    });
  });

  // ── GET /customers/search ─────────────────────────────────────────────────

  describe('search', () => {
    it('delegates to service.search and returns results with balance', async () => {
      const customer = makeCustomer();
      const searchResult = [{ ...customer, balance: 80 }];
      service.search.mockResolvedValue(searchResult);

      const result = await controller.search(
        { q: 'juan', limit: undefined, offset: undefined },
        'pisac',
      );

      expect(service.search).toHaveBeenCalledWith('juan', undefined);
      expect(result).toEqual(searchResult);
    });

    it('returns an empty array when no results found', async () => {
      service.search.mockResolvedValue([]);

      const result = await controller.search(
        { q: 'xyz', limit: undefined, offset: undefined },
        'pisac',
      );

      expect(result).toEqual([]);
    });
  });

  describe('getBalance (Fix #7)', () => {
    it('devuelve el updatedAt real (Date), nunca null', async () => {
      service.findByDni.mockResolvedValue({ customer: makeCustomer(), balance: makeBalance() });

      const result = await controller.getBalance('12345678', 'pisac');

      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.balance).toBe(120);
      expect(result.version).toBe(3);
    });

    it('lanza NotFoundException si el saldo no existe (estado incoherente), no emite null', async () => {
      service.findByDni.mockResolvedValue({ customer: makeCustomer(), balance: null });

      await expect(controller.getBalance('12345678', 'pisac')).rejects.toThrow(NotFoundException);
    });
  });
});
