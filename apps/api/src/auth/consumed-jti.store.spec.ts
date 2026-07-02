/**
 * ConsumedJtiStore — in-memory single-use challenge jti tracking (CP-12 / FIX 2).
 *
 * Verifies:
 *   - a consumed jti reports as consumed within its TTL
 *   - an expired jti is evicted and no longer reports as consumed
 *   - evictExpired removes past-TTL entries so the store can't grow unbounded
 */
import { ConsumedJtiStore } from './consumed-jti.store';

describe('ConsumedJtiStore', () => {
  it('reports a jti as consumed until its expiry', () => {
    const store = new ConsumedJtiStore();
    const now = 1_000_000;
    store.consume('jti-a', now + 60_000, now);
    expect(store.isConsumed('jti-a', now)).toBe(true);
  });

  it('reports an unknown jti as not consumed', () => {
    const store = new ConsumedJtiStore();
    expect(store.isConsumed('never-seen', 1_000_000)).toBe(false);
  });

  it('treats an expired jti as not consumed and evicts it', () => {
    const store = new ConsumedJtiStore();
    const now = 1_000_000;
    store.consume('jti-b', now + 60_000, now);
    // now past expiry
    expect(store.isConsumed('jti-b', now + 61_000)).toBe(false);
    expect(store.size).toBe(0);
  });

  it('evictExpired removes past-TTL entries (no unbounded growth)', () => {
    const store = new ConsumedJtiStore();
    const base = 1_000_000;
    store.consume('old-1', base + 1_000, base);
    store.consume('old-2', base + 2_000, base);
    store.consume('fresh', base + 100_000, base);
    expect(store.size).toBe(3);

    store.evictExpired(base + 5_000);

    expect(store.size).toBe(1);
    expect(store.isConsumed('fresh', base + 5_000)).toBe(true);
  });
});
