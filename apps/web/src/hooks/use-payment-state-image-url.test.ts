/**
 * CP-09 — getMethodImageUrl helper
 *
 * Tests that getMethodImageUrl returns the image URL for a payment method,
 * or null when the method has no image or is undefined.
 */
import { describe, it, expect } from 'vitest';
import { getMethodImageUrl } from '@/hooks/use-payment-state';
import type { PaymentMethod } from '@/types/models';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
const makeMethod = (overrides: Partial<PaymentMethod> = {}): PaymentMethod => ({
  id: 1,
  name: 'Yape',
  commissionPercentage: 0,
  requiresTransferTime: false,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// getMethodImageUrl
// ---------------------------------------------------------------------------
describe('getMethodImageUrl', () => {
  it('returns the imageUrl when the method has one (URL)', () => {
    const method = makeMethod({ imageUrl: 'https://example.com/yape-qr.png' });
    expect(getMethodImageUrl(method)).toBe('https://example.com/yape-qr.png');
  });

  it('returns the imageUrl when the method has a base64 data URI', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
    const method = makeMethod({ imageUrl: dataUri });
    expect(getMethodImageUrl(method)).toBe(dataUri);
  });

  it('returns null when imageUrl is null', () => {
    const method = makeMethod({ imageUrl: null });
    expect(getMethodImageUrl(method)).toBeNull();
  });

  it('returns null when imageUrl is undefined', () => {
    const method = makeMethod({ imageUrl: undefined });
    expect(getMethodImageUrl(method)).toBeNull();
  });

  it('returns null when method is undefined (no method selected)', () => {
    expect(getMethodImageUrl(undefined)).toBeNull();
  });

  it('returns null for a cash method without an image', () => {
    const cash = makeMethod({ name: 'Efectivo', imageUrl: null });
    expect(getMethodImageUrl(cash)).toBeNull();
  });
});
