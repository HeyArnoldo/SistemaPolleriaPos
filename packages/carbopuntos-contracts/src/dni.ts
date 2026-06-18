import { z } from 'zod';

// Data returned by json.pe when the DNI is found.
// Field names match the json.pe wire format (snake_case as received).
const dniDataSchema = z.object({
  numero: z.string(),
  nombres: z.string(),
  apellido_paterno: z.string(),
  apellido_materno: z.string(),
  nombre_completo: z.string(),
  direccion: z.string().optional(),
  direccion_completa: z.string().optional(),
  ubigeo_reniec: z.string().optional(),
  ubigeo_sunat: z.string().optional(),
});

// Successful response: success === true, data present.
const dniSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: dniDataSchema,
});

// Error / 404 response: success === false, no data.
const dniErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

// Discriminated union — mirrors the actual json.pe response contract.
export const dniLookupResponseSchema = z.discriminatedUnion('success', [
  dniSuccessResponseSchema,
  dniErrorResponseSchema,
]);
export type DniLookupResponse = z.infer<typeof dniLookupResponseSchema>;
export type DniData = z.infer<typeof dniDataSchema>;
