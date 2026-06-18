import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DniService } from './dni.service';

// Mock global fetch (Node 18+ lo tiene nativo; Jest lo mockea aquí).
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeConfigService(apiKey = 'test-api-key'): ConfigService {
  return {
    get: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;
}

describe('DniService', () => {
  let service: DniService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = makeConfigService();
    service = new DniService(configService);
    mockFetch.mockReset();
  });

  it('debe lanzar BadRequestException si el DNI no tiene exactamente 8 dígitos', async () => {
    await expect(service.lookup('1234567')).rejects.toThrow(BadRequestException);
    await expect(service.lookup('123456789')).rejects.toThrow(BadRequestException);
    await expect(service.lookup('1234abcd')).rejects.toThrow(BadRequestException);
  });

  it('debe retornar los datos del cliente cuando json.pe responde success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          message: 'exito',
          data: {
            numero: '27427864',
            nombres: 'JOSE PEDRO',
            apellido_paterno: 'CASTILLO',
            apellido_materno: 'TERRONES',
            nombre_completo: 'CASTILLO TERRONES, JOSE PEDRO',
          },
        }),
    });

    const result = await service.lookup('27427864');

    expect(result.firstName).toBe('JOSE PEDRO');
    expect(result.lastName).toBe('CASTILLO TERRONES');
    expect(result.fullName).toBe('CASTILLO TERRONES, JOSE PEDRO');
    expect(result.dni).toBe('27427864');
  });

  it('debe incluir el header Authorization con el api key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          message: 'exito',
          data: {
            numero: '12345678',
            nombres: 'ANA',
            apellido_paterno: 'GARCIA',
            apellido_materno: 'LOPEZ',
            nombre_completo: 'GARCIA LOPEZ, ANA',
          },
        }),
    });

    await service.lookup('12345678');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.json.pe/api/dni',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('debe lanzar NotFoundException si json.pe retorna success:false', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ success: false, message: 'No se encontró DNI' }),
    });

    await expect(service.lookup('99999999')).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar ServiceUnavailableException si fetch lanza error de red', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));

    await expect(service.lookup('12345678')).rejects.toThrow(ServiceUnavailableException);
  });

  it('debe lanzar ServiceUnavailableException si fetch lanza AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    await expect(service.lookup('12345678')).rejects.toThrow(ServiceUnavailableException);
  });
});
