/**
 * T-TOTP-3 — User entity: totpSecret and totpEnabled columns.
 * Verifies entity defaults and type contracts before migration is applied.
 */
import { User } from './user.entity';

describe('User entity — TOTP fields (T-TOTP-3)', () => {
  describe('totpEnabled', () => {
    it('defaults to false on a new instance', () => {
      const user = new User();
      expect(user.totpEnabled).toBe(false);
    });

    it('is a boolean', () => {
      const user = new User();
      expect(typeof user.totpEnabled).toBe('boolean');
    });

    it('can be set to true', () => {
      const user = new User();
      user.totpEnabled = true;
      expect(user.totpEnabled).toBe(true);
    });
  });

  describe('totpSecret', () => {
    it('defaults to null on a new instance', () => {
      const user = new User();
      expect(user.totpSecret).toBeNull();
    });

    it('can be set to an encrypted envelope string', () => {
      const user = new User();
      user.totpSecret = 'v1:abc:def:ghi';
      expect(user.totpSecret).toBe('v1:abc:def:ghi');
    });

    it('accepts null (clearing the secret)', () => {
      const user = new User();
      user.totpSecret = 'v1:abc:def:ghi';
      user.totpSecret = null;
      expect(user.totpSecret).toBeNull();
    });
  });
});
