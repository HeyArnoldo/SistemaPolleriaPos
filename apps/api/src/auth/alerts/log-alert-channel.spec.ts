/**
 * WU3a — LogAlertChannel unit tests.
 * Verifies:
 *   - name is 'log'
 *   - send() logs a structured line with sede, occurredAt, username, failureCount
 *   - send() resolves (does not throw)
 */
import { Logger } from '@nestjs/common';
import { LogAlertChannel } from './log-alert-channel';
import { LockoutAlertPayload } from './alert-channel';

describe('LogAlertChannel', () => {
  let channel: LogAlertChannel;

  beforeEach(() => {
    channel = new LogAlertChannel();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('name is "log"', () => {
    expect(channel.name).toBe('log');
  });

  it('send() resolves without throwing', async () => {
    const payload: LockoutAlertPayload = {
      username: 'admin',
      sede: 'sede-calca',
      ipAddress: '10.0.0.1',
      failureCount: 5,
      occurredAt: new Date('2026-01-01T12:00:00Z'),
    };

    await expect(channel.send(payload)).resolves.toBeUndefined();
  });

  it('send() logs a structured warn line including username, sede, failureCount, and occurredAt', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const payload: LockoutAlertPayload = {
      username: 'cajero1',
      sede: 'sede-lima-01',
      ipAddress: null,
      failureCount: 7,
      occurredAt: new Date('2026-06-01T08:30:00Z'),
    };

    await channel.send(payload);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logArg = warnSpy.mock.calls[0][0] as string;
    expect(logArg).toContain('cajero1');
    expect(logArg).toContain('sede-lima-01');
    expect(logArg).toContain('7');
  });
});
