import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reward } from './entities/reward.entity';
import type { CreateRewardInput, UpdateRewardInput } from '@app/carbopuntos-contracts';

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(Reward)
    private readonly rewardRepo: Repository<Reward>,
  ) {}

  findAll(): Promise<Reward[]> {
    return this.rewardRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Reward> {
    const reward = await this.rewardRepo.findOne({ where: { id } });
    if (!reward) throw new NotFoundException(`Reward ${id} not found`);
    return reward;
  }

  async create(dto: CreateRewardInput): Promise<Reward> {
    const reward = this.rewardRepo.create({
      name: dto.name,
      costPoints: dto.costPoints,
      isActive: dto.isActive ?? true,
    });
    return this.rewardRepo.save(reward);
  }

  async update(id: string, dto: UpdateRewardInput): Promise<Reward> {
    const reward = await this.findOne(id);
    if (dto.name !== undefined) reward.name = dto.name;
    if (dto.costPoints !== undefined) reward.costPoints = dto.costPoints;
    if (dto.isActive !== undefined) reward.isActive = dto.isActive;
    return this.rewardRepo.save(reward);
  }

  async deactivate(id: string): Promise<Reward> {
    const reward = await this.findOne(id);
    reward.isActive = false;
    return this.rewardRepo.save(reward);
  }
}
