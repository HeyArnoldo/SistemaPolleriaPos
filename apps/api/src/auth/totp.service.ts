/**
 * TotpService — wraps `otpauth` for TOTP operations.
 *
 * Deviation from design (D1): the design listed `otplib` with the `authenticator`
 * API as the primary choice, with `otpauth` as the pre-authorized fallback if
 * ESM/CJS build friction arises. otplib v13 ships with `"type": "module"` which
 * breaks Jest's CommonJS test runner. Per design decision D1 (apply-time switch),
 * `otpauth` is used instead — it provides a CJS-compatible node export and a
 * clean TypeScript API. The rest of the codebase depends only on TotpService,
 * not on the underlying library.
 *
 * otpauth API:
 *   - `new Secret()` / `secret.base32` — generate/access the base32 secret
 *   - `new TOTP({ issuer, label, secret })` — TOTP object
 *   - `totp.toString()` — otpauth:// URI
 *   - `totp.generate()` — current code
 *   - `totp.validate({ token, window })` — delta (0, ±N) or null if invalid
 */
import { TOTP, Secret } from 'otpauth';
import { Injectable } from '@nestjs/common';

const DEFAULT_ISSUER = 'Pollería Carbón POS';
const DEFAULT_WINDOW = 1;

@Injectable()
export class TotpService {
  /** The TOTP issuer label (from TOTP_ISSUER env, default 'Pollería Carbón POS'). */
  readonly issuer: string;
  /** Clock tolerance in time-steps (from TOTP_WINDOW env, default 1). */
  readonly window: number;

  constructor() {
    this.issuer = process.env.TOTP_ISSUER ?? DEFAULT_ISSUER;
    this.window = parseInt(process.env.TOTP_WINDOW ?? String(DEFAULT_WINDOW), 10);
  }

  /** Generates a new random base32 TOTP secret (160-bit / 20-byte). */
  generateSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  /**
   * Builds an otpauth:// URI for QR code provisioning.
   * Embeds issuer, label (username), and secret.
   * Never call this with a secret you intend to log.
   */
  buildOtpauthUri(username: string, issuer: string, secret: string): string {
    const totp = this.buildTOTP(username, issuer, secret);
    return totp.toString();
  }

  /**
   * Verifies a 6-digit TOTP code against a base32 secret.
   * Uses `TOTP_WINDOW` (default 1) as clock tolerance (±1 time step = ±30s).
   * Returns true on match, false on mismatch or any error.
   */
  verify(code: string, secret: string): boolean {
    if (!code || !secret) return false;
    try {
      const totp = this.buildTOTP('', this.issuer, secret);
      const delta = totp.validate({ token: code, window: this.window });
      return delta !== null;
    } catch {
      return false;
    }
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private buildTOTP(label: string, issuer: string, base32Secret: string): TOTP {
    return new TOTP({
      issuer,
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(base32Secret),
    });
  }
}
