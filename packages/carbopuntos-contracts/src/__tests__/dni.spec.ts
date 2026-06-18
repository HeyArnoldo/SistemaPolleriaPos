import { describe, it, expect } from 'vitest';
import { dniLookupResponseSchema } from '../dni';

describe('dniLookupResponseSchema', () => {
  it('accepts a successful lookup response (json.pe format)', () => {
    const result = dniLookupResponseSchema.safeParse({
      success: true,
      message: 'exito',
      data: {
        numero: '27427864',
        nombres: 'JOSE PEDRO',
        apellido_paterno: 'CASTILLO',
        apellido_materno: 'TERRONES',
        nombre_completo: 'CASTILLO TERRONES, JOSE PEDRO',
        direccion: '',
        direccion_completa: '',
        ubigeo_reniec: '',
        ubigeo_sunat: '',
      },
    });
    expect(result.success).toBe(true);
  });

  it('returns parsed data with correct field names', () => {
    const parsed = dniLookupResponseSchema.safeParse({
      success: true,
      message: 'exito',
      data: {
        numero: '27427864',
        nombres: 'JOSE PEDRO',
        apellido_paterno: 'CASTILLO',
        apellido_materno: 'TERRONES',
        nombre_completo: 'CASTILLO TERRONES, JOSE PEDRO',
        direccion: '',
        direccion_completa: '',
        ubigeo_reniec: '',
        ubigeo_sunat: '',
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.success) {
      expect(parsed.data.data.nombres).toBe('JOSE PEDRO');
      expect(parsed.data.data.apellido_paterno).toBe('CASTILLO');
      expect(parsed.data.data.apellido_materno).toBe('TERRONES');
      expect(parsed.data.data.nombre_completo).toBe('CASTILLO TERRONES, JOSE PEDRO');
    }
  });

  it('accepts a 404 / error response', () => {
    const result = dniLookupResponseSchema.safeParse({
      success: false,
      message: 'No se encontró DNI',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a response without success field', () => {
    const result = dniLookupResponseSchema.safeParse({
      message: 'exito',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a success response without data field', () => {
    const result = dniLookupResponseSchema.safeParse({
      success: true,
      message: 'exito',
    });
    expect(result.success).toBe(false);
  });
});
