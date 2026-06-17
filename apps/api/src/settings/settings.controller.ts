import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  SettingsService,
  updateSettingsSchema,
  UpdateSettingsDto,
} from './services/settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  updateSettings(@Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
