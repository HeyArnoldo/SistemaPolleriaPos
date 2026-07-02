import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const VERSION_PREFIX = 'v1';

/**
 * TotpCryptoService — AES-256-GCM envelope encryption for TOTP secrets at rest.
 *
 * Envelope format: `v1:<ivB64>:<tagB64>:<ciphertextB64>`
 *
 * Key source: TOTP_ENCRYPTION_KEY env var (32-byte key, base64 or hex).
 * If the key is absent or invalid, the constructor throws loudly.
 *
 * Use TotpCryptoService.tryCreate() to get null instead of throwing (for seed/startup checks).
 */
@Injectable()
export class TotpCryptoService {
  private readonly logger = new Logger(TotpCryptoService.name);
  private readonly key: Buffer;

  constructor() {
    this.key = TotpCryptoService.loadKey();
  }

  /** Returns true — always true on a successfully constructed instance (key is valid). */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Factory that returns null instead of throwing when TOTP_ENCRYPTION_KEY is absent
   * or invalid. Use for seed scripts and optional startup checks.
   */
  static tryCreate(): TotpCryptoService | null {
    try {
      return new TotpCryptoService();
    } catch {
      return null;
    }
  }

  /**
   * Encrypts a plaintext TOTP secret into a v1 envelope.
   * Each call produces a unique envelope (random IV).
   * Never logs the plaintext.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      VERSION_PREFIX,
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypts a v1 envelope. Throws on malformed input or auth-tag mismatch.
   * Never logs the plaintext.
   */
  decrypt(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
      throw new Error(`TotpCrypto: malformed envelope (expected v1:<iv>:<tag>:<ct>)`);
    }
    const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];

    let iv: Buffer;
    let tag: Buffer;
    let ct: Buffer;
    try {
      iv = Buffer.from(ivB64, 'base64');
      tag = Buffer.from(tagB64, 'base64');
      ct = Buffer.from(ctB64, 'base64');
    } catch {
      throw new Error('TotpCrypto: base64 decode failed in envelope parts');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    // GCM auth-tag verification throws on mismatch during final()
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Throws ServiceUnavailableException with a clear message.
   * Use this in enrollment endpoints when the key is absent.
   */
  static unavailableError(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'TOTP encryption key is not configured. ' +
        'Set TOTP_ENCRYPTION_KEY (32-byte key as base64 or hex) to enable TOTP enrollment.',
    );
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private static loadKey(): Buffer {
    const raw = process.env.TOTP_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error(
        'TOTP_ENCRYPTION_KEY is not set. ' + 'Provide a 32-byte AES key encoded as base64 or hex.',
      );
    }

    // Try base64 first; fall back to hex
    let key = TotpCryptoService.tryDecode(raw, 'base64');
    if (!key || key.length !== KEY_BYTES) {
      key = TotpCryptoService.tryDecode(raw, 'hex');
    }

    if (!key || key.length !== KEY_BYTES) {
      throw new Error(
        `TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes. ` +
          `Got ${key?.length ?? 0} bytes. ` +
          `Generate with: openssl rand -base64 32`,
      );
    }

    return key;
  }

  private static tryDecode(value: string, encoding: BufferEncoding): Buffer | null {
    try {
      const buf = Buffer.from(value, encoding);
      // Buffer.from with base64/hex is lenient — verify the round-trip to catch garbage input
      if (encoding === 'hex' && !/^[0-9a-fA-F]+$/.test(value)) return null;
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  }
}
