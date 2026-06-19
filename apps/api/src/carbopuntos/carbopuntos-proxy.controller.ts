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
  listCustomersQuerySchema,
} from '@app/carbopuntos-contracts';
import type {
  CustomerSearchInput,
  AffiliateCustomerInput,
  ListCustomersQuery,
} from '@app/carbopuntos-contracts';
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
  // Customer list (paginated, no text filter) — must be declared FIRST so NestJS
  // does not confuse the literal "customers" segment with the "/:dni" param route.
  // Route order: GET customers → GET customers/search → GET customers/:dni
  // ---------------------------------------------------------------------------

  /**
   * GET /api/carbopuntos/customers
   *
   * Returns a paginated list of all customers with embedded balances.
   * Used by the admin "Clientes" page to show the list without requiring a search query.
   */
  @Get('customers')
  listCustomers(@Query(new ZodValidationPipe(listCustomersQuerySchema)) query: ListCustomersQuery) {
    return this.client.listCustomers(query);
  }

  // ---------------------------------------------------------------------------
  // Customer lookup / search
  // ---------------------------------------------------------------------------

  /** GET /api/carbopuntos/customers/search?q= */
  @Get('customers/search')
  searchCustomers(@Query(new ZodValidationPipe(customerSearchSchema)) query: CustomerSearchInput) {
    return this.client.search(query);
  }

  /**
   * GET /api/carbopuntos/customers/:dni — customer info + current balance.
   *
   * Returns { dni, balance } where balance is the integer point balance.
   * Also includes customer fields (fullName etc.) by searching the hub,
   * so the cashier panel can display the customer name without a second call.
   */
  @Get('customers/:dni')
  async getCustomerByDni(@Param('dni') dni: string) {
    const [balanceResult, customers] = await Promise.all([
      this.client.getBalance(dni),
      this.client.search({ q: dni }),
    ]);
    const customer = customers.find((c) => c.dni === dni) ?? null;
    return { dni, balance: balanceResult.balance, customer };
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
