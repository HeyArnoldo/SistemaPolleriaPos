import { describe, it, expect } from 'vitest';
import { createSaleNumberKeeper, parseSaleNumberSeq } from '@/lib/ventas';

describe('createSaleNumberKeeper', () => {
  it('returns the same sale number across repeated get() calls (rapid double-click safe)', () => {
    let calls = 0;
    const keeper = createSaleNumberKeeper(() => `JUL-22-${String(++calls).padStart(4, '0')}`);

    const first = keeper.get();

    expect(keeper.get()).toBe(first);
    expect(keeper.get()).toBe(first);
    expect(calls).toBe(1); // generator invoked only once for the whole cart
  });

  it('issues a fresh sale number only after reset() (next cart)', () => {
    let calls = 0;
    const keeper = createSaleNumberKeeper(() => `JUL-22-${String(++calls).padStart(4, '0')}`);

    const first = keeper.get();
    keeper.reset();
    const second = keeper.get();

    expect(second).not.toBe(first);
    expect(calls).toBe(2);
  });
});

describe('parseSaleNumberSeq', () => {
  it('extracts the sequence from a valid sale number', () => {
    expect(parseSaleNumberSeq('JUL-24-0120')).toBe(120);
    expect(parseSaleNumberSeq('ENE-01-0001')).toBe(1);
    expect(parseSaleNumberSeq('jul-24-0007')).toBe(7); // case-insensitive
  });

  it('returns null for malformed sale numbers', () => {
    expect(parseSaleNumberSeq('SALE-123')).toBeNull();
    expect(parseSaleNumberSeq('XXX-24-0120')).toBeNull();
    expect(parseSaleNumberSeq('')).toBeNull();
  });
});
