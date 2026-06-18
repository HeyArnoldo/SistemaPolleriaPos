import { z } from 'zod';

const dniPattern = /^[0-9]{8}$/;

// Full customer record returned by the hub.
export const customerSchema = z.object({
  id: z.string().uuid(),
  dni: z.string().regex(dniPattern, 'DNI must be exactly 8 numeric digits'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().min(1),
  // Phone is optional — may be null or absent.
  phone: z.string().nullable().optional(),
  consentAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString())),
  isActive: z.boolean(),
  createdAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString())),
});
export type Customer = z.infer<typeof customerSchema>;

// Input schema for affiliating a new customer.
// The hub resolves the name via json.pe using the DNI.
export const affiliateCustomerSchema = z.object({
  dni: z.string().regex(dniPattern, 'DNI must be exactly 8 numeric digits'),
  // Phone is optional at affiliation time.
  phone: z.string().optional(),
  // Explicit consent timestamp — required for GDPR/LPDP compliance.
  consentAt: z
    .string()
    .datetime({ offset: true })
    .or(z.coerce.date().transform((d) => d.toISOString())),
});
export type AffiliateCustomerInput = z.infer<typeof affiliateCustomerSchema>;

// Query params for searching customers (by name or partial DNI).
export const customerSearchSchema = z.object({
  q: z.string().min(1, 'Search query must not be empty'),
  // Query params arrive as strings; coerce to int while keeping validation.
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
