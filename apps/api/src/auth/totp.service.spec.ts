/**
 * T-TOTP-2 — TotpService: generate secret, build URI, verify code.
 *
 * Uses otpauth for generating live codes in tests (same lib the service uses).
 * Design note: switched from otplib (design D1 primary) to otpauth (pre-authorized
 * fallback) because otplib v13 has "type":"module" which breaks Jest CJS mode.
 */
import { TOTP, Secret } from 'otpauth';
import { TotpService } from './totp.service';

function buildService(envOverrides: Record<string, string | undefined> = {}): TotpService {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    originals[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  const svc = new TotpService();
  for (const [k, v] of Object.entries(originals)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return svc;
}

/** Generate a live TOTP code for a given base32 secret using otpauth directly. */
function liveCode(base32Secret: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(base32Secret),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}

describe('TotpService (T-TOTP-2)', () => {
  describe('generateSecret()', () => {
    it('returns a non-empty base32 string', () => {
      const svc = new TotpService();
      const secret = svc.generateSecret();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThanOrEqual(16);
      expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    });

    it('each call produces a unique secret', () => {
      const svc = new TotpService();
      const a = svc.generateSecret();
      const b = svc.generateSecret();
      expect(a).not.toBe(b);
    });
  });

  describe('buildOtpauthUri()', () => {
    it('returns an otpauth:// TOTP URI', () => {
      const svc = new TotpService();
      const uri = svc.buildOtpauthUri('admin1', 'TestIssuer', 'JBSWY3DPEHPK3PXP');
      expect(uri).toMatch(/^otpauth:\/\/totp\//);
    });

    it('embeds the issuer in the URI', () => {
      const svc = new TotpService();
      const uri = svc.buildOtpauthUri('admin1', 'MyPOS', 'JBSWY3DPEHPK3PXP');
      expect(uri).toContain('MyPOS');
    });

    it('embeds the username (label) in the URI', () => {
      const svc = new TotpService();
      const uri = svc.buildOtpauthUri('cajero1', 'MyPOS', 'JBSWY3DPEHPK3PXP');
      expect(uri).toContain('cajero1');
    });

    it('defaults issuer to Pollería Carbón POS when TOTP_ISSUER is unset', () => {
      const svc = buildService({ TOTP_ISSUER: undefined });
      expect(svc.issuer).toBe('Pollería Carbón POS');
    });

    it('uses TOTP_ISSUER env var as issuer', () => {
      const svc = buildService({ TOTP_ISSUER: 'EnvIssuer' });
      expect(svc.issuer).toBe('EnvIssuer');
    });
  });

  describe('verify()', () => {
    it('accepts a live TOTP code generated from the same secret', () => {
      const svc = new TotpService();
      const secret = svc.generateSecret();
      const code = liveCode(secret);
      expect(svc.verify(code, secret)).toBe(true);
    });

    it('rejects a wrong code', () => {
      const svc = new TotpService();
      const secret = svc.generateSecret();
      expect(svc.verify('000000', secret)).toBe(false);
    });

    it('rejects an empty code', () => {
      const svc = new TotpService();
      const secret = svc.generateSecret();
      expect(svc.verify('', secret)).toBe(false);
    });

    it('defaults TOTP_WINDOW to 1 when env is unset', () => {
      const svc = buildService({ TOTP_WINDOW: undefined });
      expect(svc.window).toBe(1);
    });

    it('parses TOTP_WINDOW from env', () => {
      const svc = buildService({ TOTP_WINDOW: '2' });
      expect(svc.window).toBe(2);
    });
  });
});
