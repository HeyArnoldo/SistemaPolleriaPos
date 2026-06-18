import { describe, it, expect } from 'vitest';
import { rewardSchema } from '../reward';

describe('rewardSchema', () => {
  it('accepts a valid reward', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Gaseosa 1 LT',
      costPoints: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects reward with zero costPoints', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Gaseosa 1 LT',
      costPoints: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects reward with negative costPoints', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Gaseosa 1 LT',
      costPoints: -10,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects reward with fractional costPoints', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Gaseosa 1 LT',
      costPoints: 10.5,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects reward with empty name', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
      costPoints: 100,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('accepts reward with isActive false', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Pollo entero gratis',
      costPoints: 400,
      isActive: false,
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts reward without createdAt (optional)', () => {
    const result = rewardSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Gaseosa 1 LT',
      costPoints: 100,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});
