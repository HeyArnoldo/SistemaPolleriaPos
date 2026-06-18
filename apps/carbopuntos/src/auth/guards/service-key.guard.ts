import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { SedeCredential } from '../entities/sede-credential.entity';

/**
 * Valida el header `Authorization: Bearer <service_key>` contra las credenciales
 * almacenadas en `sede_credentials` (hash bcryptjs).
 *
 * Si la clave es válida, inyecta `req.sede` con el identificador de sede que
 * corresponde a esa clave. Todos los endpoints del hub usan este guard (D14).
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(SedeCredential)
    private readonly credentialRepo: Repository<SedeCredential>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const headers = req['headers'] as Record<string, string | undefined>;
    const authHeader = headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Se requiere Authorization: Bearer <service_key>');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Se requiere Authorization: Bearer <service_key>');
    }

    // Carga todas las credenciales activas y verifica con bcryptjs.
    // En producción la tabla es pequeña (una fila por sede); el costo es aceptable.
    const credentials = await this.credentialRepo.find({
      where: { isActive: true },
    });

    for (const cred of credentials) {
      const matches = await bcrypt.compare(token, cred.serviceKeyHash);
      if (matches) {
        // Inyecta la sede derivada en el request para que los servicios la usen.
        req['sede'] = cred.sede;
        return true;
      }
    }

    throw new UnauthorizedException('Service key inválida o sede inactiva');
  }
}
