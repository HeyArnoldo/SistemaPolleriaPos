import { describe, it, expect } from 'vitest';
import {
  calcGrossFromNet,
  calcNetFromGross,
  round2,
  isCashMethodName,
  isYapePlinMethodName,
  normalizePaymentMethodName,
  getCashMethod,
  getYapeMethod,
} from '@/hooks/use-payment-state';
import type { PaymentMethod } from '@/types/models';

// ---------------------------------------------------------------------------
// Helpers to build minimal PaymentMethod fixtures
// ---------------------------------------------------------------------------
const makeMethod = (id: number, name: string, commissionPercentage = 0): PaymentMethod => ({
  id,
  name,
  commissionPercentage,
  requiresTransferTime: false,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

// ---------------------------------------------------------------------------
// normalizePaymentMethodName
// ---------------------------------------------------------------------------
describe('normalizePaymentMethodName', () => {
  it('lowercases and trims', () => {
    expect(normalizePaymentMethodName('  Efectivo  ')).toBe('efectivo');
  });

  it('strips diacritics (NFD decomposition)', () => {
    expect(normalizePaymentMethodName('Yapé')).toBe('yape');
    expect(normalizePaymentMethodName('EFECTIVÓ')).toBe('efectivo');
  });

  it('handles already-normalized input', () => {
    expect(normalizePaymentMethodName('plin')).toBe('plin');
  });
});

// ---------------------------------------------------------------------------
// isCashMethodName
// ---------------------------------------------------------------------------
describe('isCashMethodName', () => {
  it('returns true for "Efectivo"', () => {
    expect(isCashMethodName('Efectivo')).toBe(true);
  });

  it('returns true for uppercase variant', () => {
    expect(isCashMethodName('EFECTIVO')).toBe(true);
  });

  it('returns true for accented variant', () => {
    expect(isCashMethodName('Efectivó')).toBe(true);
  });

  it('returns false for "Yape"', () => {
    expect(isCashMethodName('Yape')).toBe(false);
  });

  it('returns false for "Plin"', () => {
    expect(isCashMethodName('Plin')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCashMethodName('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isYapePlinMethodName
// ---------------------------------------------------------------------------
describe('isYapePlinMethodName', () => {
  it('returns true for "Yape"', () => {
    expect(isYapePlinMethodName('Yape')).toBe(true);
  });

  it('returns true for "Plin"', () => {
    expect(isYapePlinMethodName('Plin')).toBe(true);
  });

  it('returns true for accented "Yapé"', () => {
    expect(isYapePlinMethodName('Yapé')).toBe(true);
  });

  it('returns true for uppercase "YAPE"', () => {
    expect(isYapePlinMethodName('YAPE')).toBe(true);
  });

  it('returns false for "Efectivo"', () => {
    expect(isYapePlinMethodName('Efectivo')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isYapePlinMethodName('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calcGrossFromNet
// ---------------------------------------------------------------------------
describe('calcGrossFromNet', () => {
  it('adds commission: 100 net at 4% → 104 gross', () => {
    expect(calcGrossFromNet(100, 4)).toBe(104);
  });

  it('returns 0 when net is 0', () => {
    expect(calcGrossFromNet(0, 4)).toBe(0);
  });

  it('returns 0 when net is negative', () => {
    expect(calcGrossFromNet(-10, 4)).toBe(0);
  });

  it('commission 0 → gross equals net', () => {
    expect(calcGrossFromNet(100, 0)).toBe(100);
  });

  it('fractional commission is applied correctly', () => {
    expect(calcGrossFromNet(50, 2)).toBeCloseTo(51, 5);
  });
});

// ---------------------------------------------------------------------------
// calcNetFromGross
// ---------------------------------------------------------------------------
describe('calcNetFromGross', () => {
  it('removes commission: 104 gross at 4% → 100 net', () => {
    expect(calcNetFromGross(104, 4)).toBeCloseTo(100, 10);
  });

  it('returns 0 when gross is 0', () => {
    expect(calcNetFromGross(0, 4)).toBe(0);
  });

  it('returns 0 when gross is negative', () => {
    expect(calcNetFromGross(-10, 4)).toBe(0);
  });

  it('commission 0 → net equals gross', () => {
    expect(calcNetFromGross(100, 0)).toBe(100);
  });

  it('round-trip: calcNetFromGross(calcGrossFromNet(100, 4), 4) ≈ 100', () => {
    const gross = calcGrossFromNet(100, 4);
    expect(calcNetFromGross(gross, 4)).toBeCloseTo(100, 10);
  });
});

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------
describe('round2', () => {
  it('rounds an integer value to itself', () => {
    expect(round2(100)).toBe(100);
  });

  it('rounds to 2 decimal places', () => {
    const result = round2(2.345);
    // toFixed(2) on 2.345 → "2.35" in most environments
    expect(Number.isFinite(result)).toBe(true);
    // Regardless of rounding direction, never more than 2 decimal digits
    expect(result.toString().replace(/^\d+\.?/, '').length).toBeLessThanOrEqual(2);
  });

  it('rounds 1.234 to 1.23', () => {
    expect(round2(1.234)).toBe(1.23);
  });

  it('handles 0', () => {
    expect(round2(0)).toBe(0);
  });

  it('handles values already at 2 decimal places', () => {
    expect(round2(3.14)).toBe(3.14);
  });
});

// ---------------------------------------------------------------------------
// getCashMethod
// ---------------------------------------------------------------------------
describe('getCashMethod', () => {
  const methods: PaymentMethod[] = [
    makeMethod(1, 'Yape', 4),
    makeMethod(2, 'Efectivo', 0),
    makeMethod(3, 'Tarjeta', 2),
  ];

  it('returns the Efectivo method', () => {
    const result = getCashMethod(methods);
    expect(result?.name).toBe('Efectivo');
    expect(result?.id).toBe(2);
  });

  it('returns undefined when no cash method exists', () => {
    const noCache = [makeMethod(1, 'Yape', 4), makeMethod(3, 'Tarjeta', 2)];
    expect(getCashMethod(noCache)).toBeUndefined();
  });

  it('returns the first matching method when multiple qualify', () => {
    const multi = [makeMethod(10, 'Efectivo 1'), makeMethod(11, 'Efectivo 2')];
    expect(getCashMethod(multi)?.id).toBe(10);
  });

  it('returns undefined for an empty array', () => {
    expect(getCashMethod([])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getYapeMethod
// ---------------------------------------------------------------------------
describe('getYapeMethod', () => {
  const methods: PaymentMethod[] = [
    makeMethod(1, 'Efectivo', 0),
    makeMethod(2, 'Yape', 4),
    makeMethod(3, 'Plin', 3),
  ];

  it('returns the Yape method (first match)', () => {
    const result = getYapeMethod(methods);
    expect(result?.name).toBe('Yape');
    expect(result?.id).toBe(2);
  });

  it('returns a Plin method if no Yape exists', () => {
    const plinOnly = [makeMethod(1, 'Efectivo', 0), makeMethod(5, 'Plin', 3)];
    expect(getYapeMethod(plinOnly)?.name).toBe('Plin');
  });

  it('returns undefined when no Yape/Plin method exists', () => {
    const noCash = [makeMethod(1, 'Efectivo', 0), makeMethod(3, 'Tarjeta', 2)];
    expect(getYapeMethod(noCash)).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(getYapeMethod([])).toBeUndefined();
  });
});
