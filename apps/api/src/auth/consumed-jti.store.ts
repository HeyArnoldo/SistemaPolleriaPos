/**
 * In-memory store of consumed 2FA challenge token IDs (jti) — CP-12 hardening.
 *
 * A challenge token is single-use: once a step-2 succeeds, its jti is marked
 * consumed so the SAME token cannot be replayed to mint multiple sessions
 * within its TTL.
 *
 * LIMITATION (documented on purpose): this state is IN-PROCESS and resets on
 * restart. This POS runs ONE API instance per sede (single process), so an
 * in-memory store is sufficient — no shared store / DB table is needed. Because
 * the challenge token ALSO expires within a short TTL, the residual replay
 * window after a restart is bounded by that TTL (a consumed token that survives
 * a restart still expires on its own). Entries past their expiry are evicted so
 * the map cannot grow unbounded.
 */
export class ConsumedJtiStore {
  /** jti -> expiry epoch ms (the challenge token's own expiry). */
  private readonly consumed = new Map<string, number>();

  /**
   * Marks a jti consumed until expiresAtMs (epoch ms). Evicts stale entries on
   * every write so the map size stays bounded by the number of live tokens.
   */
  consume(jti: string, expiresAtMs: number, now: number = Date.now()): void {
    this.evictExpired(now);
    this.consumed.set(jti, expiresAtMs);
  }

  /** True if the jti was already consumed and has not yet expired. */
  isConsumed(jti: string, now: number = Date.now()): boolean {
    const expiresAtMs = this.consumed.get(jti);
    if (expiresAtMs === undefined) return false;
    if (expiresAtMs <= now) {
      this.consumed.delete(jti);
      return false;
    }
    return true;
  }

  /** Removes every entry whose expiry has passed. Prevents unbounded growth. */
  evictExpired(now: number = Date.now()): void {
    for (const [jti, expiresAtMs] of this.consumed) {
      if (expiresAtMs <= now) this.consumed.delete(jti);
    }
  }

  /** Number of currently tracked entries (introspection / tests). */
  get size(): number {
    return this.consumed.size;
  }
}
