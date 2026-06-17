import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSetting } from '../entities/store-setting.entity';
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  storeName: z.string().min(1).max(255),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(StoreSetting)
    private readonly repo: Repository<StoreSetting>,
  ) {}

  async getSettings(): Promise<StoreSetting> {
    let settings = await this.repo.findOne({ where: {} });
    if (!settings) {
      settings = await this.repo.save(this.repo.create({ storeName: 'My Store' }));
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<StoreSetting> {
    const settings = await this.getSettings();
    settings.storeName = dto.storeName;
    return this.repo.save(settings);
  }
}
