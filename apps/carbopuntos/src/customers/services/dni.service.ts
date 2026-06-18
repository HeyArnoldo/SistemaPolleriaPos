import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DNI_PATTERN = /^[0-9]{8}$/;

export interface DniLookupResult {
  dni: string;
  firstName: string;
  /** Apellido paterno + materno separados por espacio */
  lastName: string;
  /** Nombre completo tal cual retorna json.pe (RN-05) */
  fullName: string;
}

/**
 * Servicio de consulta de DNI vía json.pe (D12).
 *
 * Solo el hub llama a json.pe; las sedes nunca lo hacen directamente.
 * Se consulta una única vez al afiliar un DNI nuevo (D13).
 */
@Injectable()
export class DniService {
  private readonly logger = new Logger(DniService.name);
  private readonly apiKey: string;
  /** Timeout de 8 s — json.pe a veces tarda; no queremos cortar demasiado pronto. */
  private readonly timeoutMs = 8_000;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('JSONPE_API_KEY') ?? '';
  }

  /**
   * Consulta el nombre completo de un DNI en json.pe.
   *
   * @param dni 8 dígitos exactos
   * @throws BadRequestException si el DNI no cumple el patrón `^[0-9]{8}$`
   * @throws NotFoundException si json.pe retorna success:false (DNI inexistente)
   * @throws ServiceUnavailableException si hay error de red o timeout
   */
  async lookup(dni: string): Promise<DniLookupResult> {
    if (!DNI_PATTERN.test(dni)) {
      throw new BadRequestException(`DNI inválido: "${dni}" — se requieren exactamente 8 dígitos`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://api.json.pe/api/dni', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ dni }),
      });

      const body = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: {
          numero: string;
          nombres: string;
          apellido_paterno: string;
          apellido_materno: string;
          nombre_completo: string;
        };
      };

      if (!response.ok || !body.success || !body.data) {
        this.logger.warn(`json.pe: DNI ${dni} no encontrado — ${body.message ?? response.status}`);
        throw new NotFoundException(`DNI ${dni} no encontrado en el Registro Nacional`);
      }

      const data = body.data;
      return {
        dni: data.numero,
        firstName: data.nombres,
        lastName: `${data.apellido_paterno} ${data.apellido_materno}`.trim(),
        fullName: data.nombre_completo,
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`json.pe no disponible para DNI ${dni}: ${message}`);
      throw new ServiceUnavailableException(
        `La API de consulta de DNI no está disponible. Inténtalo de nuevo en unos momentos.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
