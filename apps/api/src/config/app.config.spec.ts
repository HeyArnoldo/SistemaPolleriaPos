/**
 * app.config — challengeExpiresToMs fail-closed parsing (CP-12 hardening / FIX 1).
 *
 * The 2FA challenge token must be SHORT-lived. Unlike expiresToMs (which falls
 * back to the 7-day session default on unparseable input), the challenge path
 * must fail CLOSED: a malformed value yields a short default (5m) and an
 * over-large value is clamped to a small maximum (15m). It must NEVER mint a
 * 7-day challenge token.
 */
import { challengeExpiresToMs } from './app.config';

const FIVE_MIN_MS = 5 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('challengeExpiresToMs — fail-closed short TTL', () => {
  it('returns the 5m default when the value is undefined', () => {
    expect(challengeExpiresToMs(undefined)).toBe(FIVE_MIN_MS);
  });

  it('fails CLOSED to the 5m default on a malformed value (never 7 days)', () => {
    const result = challengeExpiresToMs('not-a-duration');
    expect(result).toBe(FIVE_MIN_MS);
    expect(result).not.toBe(SEVEN_DAYS_MS);
  });

  it('fails CLOSED to the 5m default on an empty string', () => {
    expect(challengeExpiresToMs('')).toBe(FIVE_MIN_MS);
  });

  it('parses a valid short value within the cap', () => {
    expect(challengeExpiresToMs('5m')).toBe(FIVE_MIN_MS);
    expect(challengeExpiresToMs('120s')).toBe(120 * 1000);
  });

  it('clamps an over-large value to the 15m maximum (never 7 days)', () => {
    const result = challengeExpiresToMs('30d');
    expect(result).toBe(FIFTEEN_MIN_MS);
    expect(result).not.toBe(SEVEN_DAYS_MS);
  });

  it('clamps a value just above the cap to the 15m maximum', () => {
    expect(challengeExpiresToMs('16m')).toBe(FIFTEEN_MIN_MS);
  });
});
