import { describe, it, expect } from 'vitest';
import { listCustomersQuerySchema, listCustomersResponseSchema } from '../customer';

// RED → these tests fail until the schemas are added to customer.ts

describe('listCustomersQuerySchema', () => {
  it('accepts empty params and returns defaults (limit 50, offset 0)', () => {
    const result = listCustomersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts explicit limit and offset', () => {
    const result = listCustomersQuerySchema.safeParse({ limit: 20, offset: 40 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(40);
    }
  });

  it('coerces string values (query-string origin)', () => {
    const result = listCustomersQuerySchema.safeParse({ limit: '10', offset: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it('rejects non-integer limit after coercion', () => {
    const result = listCustomersQuerySchema.safeParse({ limit: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects negative offset', () => {
    const result = listCustomersQuerySchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero limit', () => {
    const result = listCustomersQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe('listCustomersResponseSchema', () => {
  const validItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    dni: '12345678',
    firstName: 'Juan',
    lastName: 'Perez',
    fullName: 'Juan Perez',
    phone: null,
    consentAt: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
    balance: 120,
  };

  it('accepts a valid list response', () => {
    const result = listCustomersResponseSchema.safeParse({
      items: [validItem],
      total: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty list', () => {
    const result = listCustomersResponseSchema.safeParse({ items: [], total: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects when total is missing', () => {
    const result = listCustomersResponseSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it('each item must include a balance field', () => {
    const itemWithoutBalance = { ...validItem };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (itemWithoutBalance as any).balance;
    const result = listCustomersResponseSchema.safeParse({ items: [itemWithoutBalance], total: 1 });
    expect(result.success).toBe(false);
  });
});
