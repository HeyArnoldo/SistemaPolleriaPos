import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RewardsService } from './rewards.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createRewardSchema, updateRewardSchema } from '@app/carbopuntos-contracts';
import type { CreateRewardInput, UpdateRewardInput } from '@app/carbopuntos-contracts';

@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get()
  findAll() {
    return this.rewards.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createRewardSchema)) dto: CreateRewardInput) {
    return this.rewards.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRewardSchema)) dto: UpdateRewardInput,
  ) {
    return this.rewards.update(id, dto);
  }

  // Literal route before parametric — logical delete (soft delete).
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewards.deactivate(id);
  }
}
