import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { User } from '../users/user.entity';
import { CARBOPUNTOS_CLIENT_TOKEN } from './carbopuntos.tokens';
import type { CarbopuntosClient } from '@app/carbopuntos-client';
import {
  customerSearchSchema,
  affiliateCustomerSchema,
  adjustSchema,
  voidMovementSchema,
} from '@app/carbopuntos-contracts';
import type { CustomerSearchInput, AffiliateCustomerInput } from '@app/carbopuntos-contracts';
import { z } from 'zod';

// Partial body schemas for admin operations (userRef injected server-side from JWT).
const adjustBodySchema = adjustSchema.pick({ points: true, reason: true, detail: true });
type AdjustBodyInput = z.infer<typeof adjustBodySchema>;

const voidBodySchema = voidMovementSchema.pick({ reason: true });
type VoidBodyInput = z.infer<typeof voidBodySchema>;

/**
 * Proxy controller that exposes CarbopuntosHub operations to the web front-end.
 *
 * All routes require JWT auth. Admin-only routes additionally require RolesGuard.
 * The hub authenticates the sede via ServiceKeyGuard (Bearer token set in the client).
 */
@UseGuards(JwtAuthGuard)
@Controller('carbopuntos')
export class CarbopuntosProxyController {
  constructor(
    @Inject(CARBOPUNTOS_CLIENT_TOKEN)
    private readonly client: CarbopuntosClient,
  ) {}

  // ---------------------------------------------------------------------------
  // Customer lookup / search
  // ---------------------------------------------------------------------------

  /** GET /api/carbopuntos/customers/search?q= */
  @Get('customers/search')
  searchCustomers(@Query(new ZodValidationPipe(customerSearchSchema)) query: CustomerSearchInput) {
    return this.client.search(query);
  }

  /** GET /api/carbopuntos/customers/:dni — balance + customer reference */
  @Get('customers/:dni')
  async getCustomerBalance(@Param('dni') dni: string) {
    const balance = await this.client.getBalance(dni);
    return { dni, balance };
  }

  /** GET /api/carbopuntos/customers/:dni/history — cross-sede movement history (D25) */
  @Get('customers/:dni/history')
  getCustomerHistory(@Param('dni') dni: string) {
    return this.client.getHistory(dni);
  }

  // ---------------------------------------------------------------------------
  // Customer affiliation
  // ---------------------------------------------------------------------------

  /** POST /api/carbopuntos/customers — lookup or affiliate (phone + consent optional) */
  @Post('customers')
  affiliateCustomer(
    @Body(new ZodValidationPipe(affiliateCustomerSchema)) body: AffiliateCustomerInput,
  ) {
    return this.client.lookupOrAffiliate(body);
  }

  // ---------------------------------------------------------------------------
  // Admin-only: manual point adjustment
  // ---------------------------------------------------------------------------

  /**
   * POST /api/carbopuntos/customers/:dni/adjust
   * Reason is mandatory (D8/D25). Only admin users (RF-70).
   */
  @Post('customers/:dni/adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  adjustCustomerPoints(
    @Param('dni') dni: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(adjustBodySchema)) body: AdjustBodyInput,
  ) {
    return this.client.adjust({
      customerDni: dni,
      points: body.points,
      reason: body.reason,
      userRef: String(user.id),
      ...(body.detail !== undefined ? { detail: body.detail } : {}),
    });
  }

  // ---------------------------------------------------------------------------
  // Admin-only: void (soft-delete) a movement
  // ---------------------------------------------------------------------------

  /**
   * POST /api/carbopuntos/movements/:id/void
   * Triggers balance recalculation in the hub (D7/D25). Only admin users (RF-70).
   */
  @Post('movements/:id/void')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  voidMovement(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(voidBodySchema)) body: VoidBodyInput,
  ) {
    return this.client.voidMovement({
      movementId: id,
      reason: body.reason,
      userRef: String(user.id),
    });
  }
}
