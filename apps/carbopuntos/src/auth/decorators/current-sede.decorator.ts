import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador que extrae `req.sede` inyectado por `ServiceKeyGuard`.
 * Uso: @CurrentSede() sede: string
 */
export const CurrentSede = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
  return request['sede'] as string;
});
