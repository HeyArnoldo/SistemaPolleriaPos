import { describe, it, expect } from 'vitest';
import { customerSchema, affiliateCustomerSchema, customerSearchSchema } from '../customer';

describe('customerSchema', () => {
  it('accepts a valid customer', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '12345678',
      firstName: 'Jose Pedro',
      lastName: 'Castillo Terrones',
      fullName: 'CASTILLO TERRONES, JOSE PEDRO',
      phone: null,
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects dni shorter than 8 digits', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '1234567',
      firstName: 'Jose',
      lastName: 'Castillo',
      fullName: 'CASTILLO, JOSE',
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects dni longer than 8 digits', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '123456789',
      firstName: 'Jose',
      lastName: 'Castillo',
      fullName: 'CASTILLO, JOSE',
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects dni with non-numeric characters', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '1234567A',
      firstName: 'Jose',
      lastName: 'Castillo',
      fullName: 'CASTILLO, JOSE',
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('accepts customer without phone (optional)', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '12345678',
      firstName: 'Jose',
      lastName: 'Castillo',
      fullName: 'CASTILLO, JOSE',
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts customer with a phone value', () => {
    const result = customerSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      dni: '12345678',
      firstName: 'Jose',
      lastName: 'Castillo',
      fullName: 'CASTILLO, JOSE',
      phone: '987654321',
      consentAt: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe('affiliateCustomerSchema', () => {
  it('accepts a valid affiliation request', () => {
    const result = affiliateCustomerSchema.safeParse({
      dni: '12345678',
      phone: '987654321',
      consentAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts affiliation without phone (optional)', () => {
    const result = affiliateCustomerSchema.safeParse({
      dni: '12345678',
      consentAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects affiliation without consentAt (required)', () => {
    const result = affiliateCustomerSchema.safeParse({
      dni: '12345678',
      phone: '987654321',
    });
    expect(result.success).toBe(false);
  });

  it('rejects affiliation with invalid dni', () => {
    const result = affiliateCustomerSchema.safeParse({
      dni: '1234567',
      consentAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects affiliation with a malformed consentAt timestamp', () => {
    const result = affiliateCustomerSchema.safeParse({
      dni: '12345678',
      consentAt: 'not-a-timestamp',
    });
    expect(result.success).toBe(false);
  });
});

describe('customerSearchSchema', () => {
  it('accepts a valid search query', () => {
    const result = customerSearchSchema.safeParse({ q: 'Castillo' });
    expect(result.success).toBe(true);
  });

  it('accepts a search with pagination', () => {
    const result = customerSearchSchema.safeParse({ q: 'Castillo', limit: 10, offset: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects empty query string', () => {
    const result = customerSearchSchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });
});
