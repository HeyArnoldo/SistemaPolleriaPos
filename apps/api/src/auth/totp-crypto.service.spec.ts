/**
 * T-TOTP-1 — TotpCryptoService: AES-256-GCM encrypt/decrypt round-trip.
 * RED first: tests must fail before TotpCryptoService exists.
 */
import { TotpCryptoService } from './totp-crypto.service';

// A valid 32-byte key encoded as base64 (for test isolation — no env dependency)
const VALID_KEY_B64 = Buffer.alloc(32, 0xab).toString('base64');
const VALID_KEY_HEX = Buffer.alloc(32, 0xcd).toString('hex');

function buildService(keyEnv?: string): TotpCryptoService {
  const original = process.env.TOTP_ENCRYPTION_KEY;
  if (keyEnv !== undefined) {
    process.env.TOTP_ENCRYPTION_KEY = keyEnv;
  } else {
    delete process.env.TOTP_ENCRYPTION_KEY;
  }
  const svc = new TotpCryptoService();
  process.env.TOTP_ENCRYPTION_KEY = original;
  return svc;
}

describe('TotpCryptoService — encrypt/decrypt (T-TOTP-1)', () => {
  describe('with a valid base64 key', () => {
    it('encrypts a secret and produces a v1 envelope', () => {
      const svc = buildService(VALID_KEY_B64);
      const envelope = svc.encrypt('JBSWY3DPEHPK3PXP');
      expect(envelope).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    });

    it('round-trips the plaintext: decrypt(encrypt(plain)) === plain', () => {
      const svc = buildService(VALID_KEY_B64);
      const plain = 'JBSWY3DPEHPK3PXP';
      const envelope = svc.encrypt(plain);
      expect(svc.decrypt(envelope)).toBe(plain);
    });

    it('each encrypt call produces a unique envelope (random IV)', () => {
      const svc = buildService(VALID_KEY_B64);
      const a = svc.encrypt('SECRET');
      const b = svc.encrypt('SECRET');
      expect(a).not.toBe(b);
    });

    it('rejects a tampered envelope (auth tag mismatch)', () => {
      const svc = buildService(VALID_KEY_B64);
      const envelope = svc.encrypt('MYSECRET');
      // Corrupt the last byte of the ciphertext part
      const parts = envelope.split(':');
      const lastPart = parts[3] ?? '';
      const corrupted = lastPart.slice(0, -1) + (lastPart.endsWith('A') ? 'B' : 'A');
      parts[3] = corrupted;
      expect(() => svc.decrypt(parts.join(':'))).toThrow();
    });

    it('rejects a malformed envelope (wrong prefix)', () => {
      const svc = buildService(VALID_KEY_B64);
      expect(() => svc.decrypt('v0:abc:def:ghi')).toThrow();
    });

    it('rejects an envelope with wrong number of parts', () => {
      const svc = buildService(VALID_KEY_B64);
      expect(() => svc.decrypt('v1:abc:def')).toThrow();
    });
  });

  describe('with a valid hex key', () => {
    it('round-trips correctly with a hex key', () => {
      const svc = buildService(VALID_KEY_HEX);
      const plain = 'HEXKEYTEST';
      expect(svc.decrypt(svc.encrypt(plain))).toBe(plain);
    });
  });

  describe('key validation errors', () => {
    it('throws loudly when TOTP_ENCRYPTION_KEY is absent', () => {
      expect(() => buildService(undefined)).toThrow(/TOTP_ENCRYPTION_KEY/);
    });

    it('throws loudly when key decodes to wrong length (not 32 bytes)', () => {
      const shortKey = Buffer.alloc(16, 0xaa).toString('base64');
      expect(() => buildService(shortKey)).toThrow(/32.byte/i);
    });

    it('throws loudly when key is neither valid base64 nor valid hex', () => {
      expect(() => buildService('not-a-valid-key!!!!')).toThrow();
    });
  });

  describe('isAvailable()', () => {
    it('returns true when a valid key is configured', () => {
      const svc = buildService(VALID_KEY_B64);
      expect(svc.isAvailable()).toBe(true);
    });

    it('returns null from tryCreate() when key is absent', () => {
      const original = process.env.TOTP_ENCRYPTION_KEY;
      delete process.env.TOTP_ENCRYPTION_KEY;
      const result = TotpCryptoService.tryCreate();
      process.env.TOTP_ENCRYPTION_KEY = original;
      expect(result).toBeNull();
    });

    it('returns a service instance from tryCreate() when key is valid', () => {
      const original = process.env.TOTP_ENCRYPTION_KEY;
      process.env.TOTP_ENCRYPTION_KEY = VALID_KEY_B64;
      const result = TotpCryptoService.tryCreate();
      process.env.TOTP_ENCRYPTION_KEY = original;
      expect(result).not.toBeNull();
      expect(result!.isAvailable()).toBe(true);
    });
  });
});
