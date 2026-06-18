import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarbopuntosClient } from '@app/carbopuntos-client';
import { CarbopuntosPendingMovement } from './entities/pending-movement.entity';
import { CarbopuntosPendingService } from './pending-queue.service';
import { CarbopuntosSyncController } from './carbopuntos-sync.controller';
import { CARBOPUNTOS_CLIENT_TOKEN, CARBOPUNTOS_PENDING_TOKEN } from './carbopuntos.tokens';

export { CARBOPUNTOS_CLIENT_TOKEN, CARBOPUNTOS_PENDING_TOKEN } from './carbopuntos.tokens';

@Module({
  imports: [TypeOrmModule.forFeature([CarbopuntosPendingMovement])],
  providers: [
    {
      provide: CARBOPUNTOS_CLIENT_TOKEN,
      useFactory: (config: ConfigService) => {
        const hubUrl = config.get<string>('CARBOPUNTOS_HUB_URL', '');
        const serviceKey = config.get<string>('CARBOPUNTOS_SERVICE_KEY', '');
        // If hub URL is not configured, return null — the service handles null gracefully.
        if (!hubUrl || !serviceKey) return null;
        return new CarbopuntosClient({ baseUrl: hubUrl, serviceKey });
      },
      inject: [ConfigService],
    },
    CarbopuntosPendingService,
    {
      provide: CARBOPUNTOS_PENDING_TOKEN,
      useExisting: CarbopuntosPendingService,
    },
  ],
  controllers: [CarbopuntosSyncController],
  exports: [CARBOPUNTOS_CLIENT_TOKEN, CARBOPUNTOS_PENDING_TOKEN, CarbopuntosPendingService],
})
export class CarbopuntosModule {}
