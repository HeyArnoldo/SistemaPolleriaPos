import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ServiceKeyGuard } from '../auth/guards/service-key.guard';
import { CurrentSede } from '../auth/decorators/current-sede.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CustomersService } from './services/customers.service';
import {
  affiliateCustomerSchema,
  customerSearchSchema,
  type AffiliateCustomerInput,
  type CustomerSearchInput,
} from '@app/carbopuntos-contracts';

/**
 * Endpoints de clientes del hub carbopuntos.
 *
 * Rutas (bajo el prefijo global /api):
 *   POST   /customers              — afiliar (buscar local → json.pe → crear)
 *   GET    /customers/search?q=    — búsqueda por nombre o DNI parcial
 *   GET    /customers/:dni         — detalle + saldo
 *   GET    /customers/:dni/balance — solo el saldo
 *   GET    /customers/:dni/history — historial cross-sede (D25)
 *
 * Nota: /customers/search debe ir ANTES de /customers/:dni para que Express
 * no lo interprete como un DNI.
 */
@UseGuards(ServiceKeyGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  async affiliate(
    @Body(new ZodValidationPipe(affiliateCustomerSchema)) body: AffiliateCustomerInput,
    @CurrentSede() _sede: string,
  ) {
    return this.customersService.affiliate({
      dni: body.dni,
      phone: body.phone,
      consentAt: body.consentAt,
    });
  }

  // IMPORTANTE: esta ruta debe ir antes de /:dni
  @Get('search')
  async search(
    @Query(new ZodValidationPipe(customerSearchSchema)) query: CustomerSearchInput,
    @CurrentSede() _sede: string,
  ) {
    return this.customersService.search(query.q, query.limit);
  }

  @Get(':dni')
  async findByDni(@Param('dni') dni: string, @CurrentSede() _sede: string) {
    const { customer, balance } = await this.customersService.findByDni(dni);
    return {
      ...customer,
      balance: balance?.balance ?? 0,
      version: balance?.version ?? 0,
    };
  }

  @Get(':dni/balance')
  async getBalance(@Param('dni') dni: string, @CurrentSede() _sede: string) {
    const { customer, balance } = await this.customersService.findByDni(dni);
    return {
      customerId: customer.id,
      balance: balance?.balance ?? 0,
      version: balance?.version ?? 0,
      updatedAt: balance?.updatedAt ?? null,
    };
  }

  @Get(':dni/history')
  async getHistory(@Param('dni') dni: string, @CurrentSede() _sede: string) {
    return this.customersService.getHistory(dni);
  }
}
