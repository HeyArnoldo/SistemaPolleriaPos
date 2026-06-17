import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BIQuery, biQuerySchema } from '@app/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BIReportService } from './services/bi-report.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('bi')
export class BIController {
  constructor(private readonly biReportService: BIReportService) {}

  @Get('summary')
  summary(@Query(new ZodValidationPipe(biQuerySchema)) query: BIQuery) {
    return this.biReportService.getSummary(query);
  }

  @Get('detail')
  detail(@Query(new ZodValidationPipe(biQuerySchema)) query: BIQuery) {
    return this.biReportService.getDetail(query);
  }

  @Get('commissions')
  commissions(@Query(new ZodValidationPipe(biQuerySchema)) query: BIQuery) {
    return this.biReportService.getCommissionsReport(query);
  }

  @Get('trends')
  trends(@Query(new ZodValidationPipe(biQuerySchema)) query: BIQuery) {
    return this.biReportService.getTrends(query);
  }
}
