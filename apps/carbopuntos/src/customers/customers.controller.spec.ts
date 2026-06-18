import { NotFoundException } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './services/customers.service';
import { Customer } from './entities/customer.entity';
import { PointsBalance } from '../points/entities/points-balance.entity';

function makeCustomer(): Customer {
  return { id: 'a1b2', dni: '12345678' } as Customer;
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
  let service: { findByDni: jest.Mock };

  beforeEach(() => {
    service = { findByDni: jest.fn() };
    controller = new CustomersController(service as unknown as CustomersService);
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
