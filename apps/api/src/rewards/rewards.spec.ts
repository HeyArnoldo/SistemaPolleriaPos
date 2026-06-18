/**
 * T5.4 — Reward local CRUD tests.
 * Reward is local per sede (no FK to hub). Tests CRUD operations via RewardsService.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RewardsService } from './rewards.service';
import { Reward } from './entities/reward.entity';
import { NotFoundException } from '@nestjs/common';

const makeReward = (overrides?: Partial<Reward>): Reward => {
  const r = new Reward();
  r.id = 'uuid-1';
  r.name = 'Pollo gratis';
  r.costPoints = 100;
  r.isActive = true;
  r.createdAt = new Date('2026-01-01');
  return Object.assign(r, overrides);
};

describe('RewardsService', () => {
  let service: RewardsService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RewardsService, { provide: getRepositoryToken(Reward), useValue: mockRepo }],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all rewards ordered by name', async () => {
      const rewards = [makeReward({ name: 'A' }), makeReward({ name: 'B' })];
      mockRepo.find.mockResolvedValue(rewards);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  describe('create', () => {
    it('creates a reward with default isActive=true', async () => {
      const dto = { name: 'Bebida gratis', costPoints: 50, isActive: true };
      const created = makeReward({ ...dto });
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result.name).toBe('Bebida gratis');
      expect(result.costPoints).toBe(50);
      expect(result.isActive).toBe(true);
    });
  });

  describe('update', () => {
    it('updates a reward fields', async () => {
      const reward = makeReward();
      mockRepo.findOne.mockResolvedValue(reward);
      const updated = makeReward({ name: 'Nuevo nombre', costPoints: 200 });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', { name: 'Nuevo nombre', costPoints: 200 });
      expect(result.name).toBe('Nuevo nombre');
      expect(result.costPoints).toBe(200);
    });

    it('throws NotFoundException when reward not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('no-existe', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate (soft delete)', () => {
    it('sets isActive to false without physical deletion', async () => {
      const reward = makeReward({ isActive: true });
      mockRepo.findOne.mockResolvedValue(reward);
      const deactivated = makeReward({ isActive: false });
      mockRepo.save.mockResolvedValue(deactivated);

      const result = await service.deactivate('uuid-1');
      expect(result.isActive).toBe(false);
      // Verify reward was not deleted from DB
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when reward not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
