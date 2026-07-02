/**
 * T1.1 — User.isSystem field validation.
 * Tests the isSystem property on the User entity (default false).
 */
import { User } from './user.entity';

describe('User entity — isSystem field', () => {
  it('isSystem defaults to false when not set', () => {
    const user = new User();
    // Column default is applied at DB level; TypeScript entity default must also be false.
    expect(user.isSystem).toBe(false);
  });

  it('isSystem can be set to true', () => {
    const user = new User();
    user.isSystem = true;
    expect(user.isSystem).toBe(true);
  });

  it('isSystem is a boolean type', () => {
    const user = new User();
    expect(typeof user.isSystem).toBe('boolean');
  });
});
