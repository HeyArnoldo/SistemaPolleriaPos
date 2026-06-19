import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { DniService } from './dni.service';
import { PointsBalance } from '../../points/entities/points-balance.entity';
import { PointsMovement } from '../../points/entities/points-movement.entity';
import type { ListCustomersQuery } from '@app/carbopuntos-contracts';

export interface AffiliateInput {
  dni: string;
  phone?: string;
  consentAt: string;
}

export interface CustomerWithBalance {
  customer: Customer;
  balance: PointsBalance | null;
}

/**
 * Servicio principal de clientes del hub.
 *
 * Flujo de afiliación: busca local → si no existe llama DniService → crea Customer
 * + PointsBalance en una transacción (saldo inicial 0).
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,

    @InjectRepository(PointsMovement)
    private readonly movementRepo: Repository<PointsMovement>,

    @InjectRepository(PointsBalance)
    private readonly balanceRepo: Repository<PointsBalance>,

    private readonly dniService: DniService,
  ) {}

  /**
   * Afilia un cliente por DNI. Si ya existe, lo retorna sin cambios.
   * Si es nuevo, consulta json.pe y lo crea con saldo 0.
   */
  async affiliate(input: AffiliateInput): Promise<Customer> {
    const existing = await this.customerRepo.findOne({ where: { dni: input.dni } });
    if (existing) {
      this.logger.log(`Cliente ${input.dni} ya afiliado — retornando registro existente`);
      return existing;
    }

    const dniData = await this.dniService.lookup(input.dni);

    return this.customerRepo.manager.transaction(async (manager) => {
      const customer = await manager.save(
        manager.create(Customer, {
          dni: dniData.dni,
          firstName: dniData.firstName,
          lastName: dniData.lastName,
          fullName: dniData.fullName,
          phone: input.phone ?? null,
          consentAt: new Date(input.consentAt),
          isActive: true,
        }),
      );

      // Crea el registro de saldo con balance 0 y version 0.
      await manager.save(
        manager.create(PointsBalance, {
          customerId: customer.id,
          balance: 0,
        }),
      );

      this.logger.log(`Nuevo cliente afiliado: ${dniData.fullName} (DNI ${dniData.dni})`);
      return customer;
    });
  }

  /**
   * Returns a paginated list of all customers, each enriched with their
   * current balance. Ordered by created_at DESC.
   */
  async list(params: ListCustomersQuery): Promise<{
    items: Array<Customer & { balance: number }>;
    total: number;
  }> {
    const { limit, offset } = params;

    const [customers, total] = await this.customerRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Fetch balances for all customers in a single query.
    const customerIds = customers.map((c) => c.id);
    // Short-circuit on an empty page: `In([])` can yield invalid/unsafe SQL
    // depending on the driver, and there is nothing to look up anyway.
    const balances =
      customerIds.length > 0
        ? await this.balanceRepo.find({
            where: { customerId: In(customerIds) },
          })
        : [];

    const balanceMap = new Map(balances.map((b) => [b.customerId, b.balance]));

    const items = customers.map((c) => ({
      ...c,
      balance: balanceMap.get(c.id) ?? 0,
    }));

    return { items, total };
  }

  /**
   * Busca clientes por nombre completo o DNI parcial.
   * Cada resultado incluye el saldo actual (mismo patrón que list).
   * Límite configurable; default 20.
   */
  async search(q: string, limit = 20): Promise<Array<Customer & { balance: number }>> {
    const customers = await this.customerRepo.find({
      where: [{ fullName: ILike(`%${q}%`) }, { dni: ILike(`%${q}%`) }],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    // Short-circuit on an empty result: `In([])` can yield invalid/unsafe SQL.
    const customerIds = customers.map((c) => c.id);
    const balances =
      customerIds.length > 0
        ? await this.balanceRepo.find({
            where: { customerId: In(customerIds) },
          })
        : [];

    const balanceMap = new Map(balances.map((b) => [b.customerId, b.balance]));

    return customers.map((c) => ({
      ...c,
      balance: balanceMap.get(c.id) ?? 0,
    }));
  }

  /**
   * Retorna el cliente con su saldo actual.
   * @throws NotFoundException si el DNI no está registrado.
   */
  async findByDni(dni: string): Promise<CustomerWithBalance> {
    const customer = await this.customerRepo.findOne({ where: { dni } });
    if (!customer) throw new NotFoundException(`Cliente con DNI ${dni} no encontrado`);

    const balance = await this.balanceRepo.findOne({ where: { customerId: customer.id } });

    return { customer, balance };
  }

  /**
   * Historial cross-sede de movimientos del cliente (D25).
   * Retorna TODOS los movimientos, incluyendo los de otras sedes, con el campo `sede` en cada uno.
   * @throws NotFoundException si el DNI no está registrado.
   */
  async getHistory(dni: string): Promise<PointsMovement[]> {
    const customer = await this.customerRepo.findOne({ where: { dni } });
    if (!customer) throw new NotFoundException(`Cliente con DNI ${dni} no encontrado`);

    return this.movementRepo.find({
      where: { customerId: customer.id },
      order: { createdAt: 'DESC' },
    });
  }
}
