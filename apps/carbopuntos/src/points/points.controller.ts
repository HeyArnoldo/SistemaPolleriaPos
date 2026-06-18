import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ServiceKeyGuard } from '../auth/guards/service-key.guard';
import { CurrentSede } from '../auth/decorators/current-sede.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PointsService } from './services/points.service';
import {
  accrueSchema,
  redeemSchema,
  mixedOperationSchema,
  reverseSchema,
  adjustSchema,
  voidMovementSchema,
  type AccrueInput,
  type RedeemInput,
  type MixedOperationInput,
  type ReverseInput,
  type AdjustInput,
  type VoidMovementInput,
} from '@app/carbopuntos-contracts';

/**
 * Endpoints de operaciones de puntos del hub.
 *
 * Rutas (bajo el prefijo global /api):
 *   POST /points/accrue             — acumulación idempotente
 *   POST /points/redeem             — canje transaccional
 *   POST /points/operation          — operación mixta atómica
 *   POST /points/reverse            — reversa por sale_ref
 *   POST /points/adjust             — ajuste admin (motivo obligatorio)
 *   POST /movements/:id/void        — anulación soft-delete
 */
@UseGuards(ServiceKeyGuard)
@Controller()
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('points/accrue')
  async accrue(
    @Body(new ZodValidationPipe(accrueSchema)) body: AccrueInput,
    @CurrentSede() sede: string,
  ) {
    return this.pointsService.accrue({ ...body, sede });
  }

  @Post('points/redeem')
  async redeem(
    @Body(new ZodValidationPipe(redeemSchema)) body: RedeemInput,
    @CurrentSede() sede: string,
  ) {
    return this.pointsService.redeem({ ...body, sede });
  }

  @Post('points/operation')
  async operation(
    @Body(new ZodValidationPipe(mixedOperationSchema)) body: MixedOperationInput,
    @CurrentSede() sede: string,
  ) {
    return this.pointsService.operation({ ...body, sede });
  }

  @Post('points/reverse')
  async reverse(
    @Body(new ZodValidationPipe(reverseSchema)) body: ReverseInput,
    @CurrentSede() sede: string,
  ) {
    const result = await this.pointsService.reverse({ ...body, sede });
    // C15: no-op se retorna como objeto con isNoOp:true.
    if (result.isNoOp) {
      return { isNoOp: true, movement: null };
    }
    return { isNoOp: false, movement: result.movement };
  }

  @Post('points/adjust')
  async adjust(
    @Body(new ZodValidationPipe(adjustSchema)) body: AdjustInput,
    @CurrentSede() sede: string,
  ) {
    return this.pointsService.adjust({ ...body, sede });
  }

  @Post('movements/:id/void')
  async voidMovement(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(voidMovementSchema)) body: VoidMovementInput,
    @CurrentSede() sede: string,
  ) {
    return this.pointsService.voidMovement({
      movementId: id,
      reason: body.reason,
      userRef: body.userRef,
      sede,
    });
  }
}
