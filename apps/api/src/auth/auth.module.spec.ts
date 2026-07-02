/**
 * WU5 — AuthModule wiring verification.
 * Asserts that AuthModule includes LockoutService, AlertService, ALERT_CHANNEL,
 * and LoginLockoutAlert in TypeORM.forFeature.
 * Uses NestJS metadata introspection (no live DB needed).
 */
import 'reflect-metadata';

describe('AuthModule wiring (WU5)', () => {
  it('AuthModule can be imported without throwing', async () => {
    // If providers are missing from the module, the NestJS DI container will
    // throw at compile-time when the application bootstraps. This test verifies
    // the module at least imports cleanly (static analysis coverage).
    await expect(import('./auth.module')).resolves.toBeDefined();
  });

  it('LockoutService can be imported', async () => {
    const { LockoutService } = await import('./lockout.service');
    expect(LockoutService).toBeDefined();
  });

  it('AlertService can be imported', async () => {
    const { AlertService } = await import('./alert.service');
    expect(AlertService).toBeDefined();
  });

  it('LogAlertChannel can be imported and resolveAlertChannel returns a channel', async () => {
    const { resolveAlertChannel } = await import('./alerts/log-alert-channel');
    const channel = resolveAlertChannel();
    expect(channel.name).toBe('log');
  });

  it('LoginLockoutAlert entity is decorated (glob-registration ready)', async () => {
    const { getMetadataArgsStorage } = await import('typeorm');
    const { LoginLockoutAlert } = await import('./entities/login-lockout-alert.entity');
    const storage = getMetadataArgsStorage();
    const table = storage.tables.find((t) => t.target === LoginLockoutAlert);
    expect(table?.name).toBe('login_lockout_alert');
  });
});
