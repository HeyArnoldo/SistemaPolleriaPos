import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CarbopuntosPendingService } from './pending-queue.service';

/**
 * CarbopuntosSyncController — exposes an endpoint to trigger retry of
 * pending hub movements. Called after connectivity is restored (D16).
 */
@UseGuards(JwtAuthGuard)
@Controller('carbopuntos')
export class CarbopuntosSyncController {
  constructor(private readonly pending: CarbopuntosPendingService) {}

  /** POST /api/carbopuntos/sync — retry all pending hub movements. */
  @Post('sync')
  async syncPending() {
    await this.pending.retryPending();
    return { message: 'Retry triggered' };
  }
}
