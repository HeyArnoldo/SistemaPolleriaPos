import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { z } from 'zod';

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1).max(100),
  commissionPercentage: z.number().min(0).max(100).optional().default(0),
  requiresTransferTime: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type CreatePaymentMethodDto = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodDto = Partial<CreatePaymentMethodDto>;

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly repo: Repository<PaymentMethod>,
  ) {}

  findAll(): Promise<PaymentMethod[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findActive(): Promise<PaymentMethod[]> {
    return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<PaymentMethod> {
    const pm = await this.repo.findOne({ where: { id } });
    if (!pm) throw new NotFoundException(`PaymentMethod ${id} not found`);
    return pm;
  }

  async create(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Payment method "${dto.name}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const pm = await this.findOne(id);
    Object.assign(pm, dto);
    return this.repo.save(pm);
  }

  async remove(id: number): Promise<void> {
    const pm = await this.findOne(id);
    await this.repo.remove(pm);
  }
}
