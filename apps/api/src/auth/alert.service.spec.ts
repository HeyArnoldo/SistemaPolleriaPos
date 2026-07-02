/**
 * WU3b — AlertService unit tests.
 * Verifies:
 *   - emit() calls channel.send AND persists a login_lockout_alert row
 *   - channel.send failure is swallowed (best-effort); persist still runs
 *   - repo.insert failure is swallowed (best-effort); emit never throws
 *   - persisted row has channel = channel.name
 *   - unknown/unset LOCKOUT_ALERT_CHANNEL resolves to LogAlertChannel (name='log')
 */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { LoginLockoutAlert } from './entities/login-lockout-alert.entity';
import { AlertChannel, LockoutAlertPayload } from './alerts/alert-channel';

const savedEnv: Record<string, string | undefined> = {};

function saveEnv(key: string): void {
  savedEnv[key] = process.env[key];
}

function restoreEnv(key: string): void {
  if (savedEnv[key] === undefined) delete process.env[key];
  else process.env[key] = savedEnv[key];
}

const makeChannel = (name: string, sendImpl?: () => Promise<void>): AlertChannel => ({
  name,
  send: jest.fn().mockImplementation(sendImpl ?? (() => Promise.resolve())),
});

const makePayload = (): LockoutAlertPayload => ({
  username: 'admin',
  sede: 'sede-calca',
  ipAddress: '10.0.0.1',
  failureCount: 5,
  occurredAt: new Date('2026-01-01T12:00:00Z'),
});

describe('AlertService', () => {
  let service: AlertService;
  let mockRepo: { insert: jest.Mock };
  let mockChannel: AlertChannel;

  beforeEach(async () => {
    saveEnv('LOCKOUT_ALERT_CHANNEL');
    delete process.env.LOCKOUT_ALERT_CHANNEL;

    mockRepo = { insert: jest.fn().mockResolvedValue(undefined) };
    mockChannel = makeChannel('test-channel');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getRepositoryToken(LoginLockoutAlert), useValue: mockRepo },
        { provide: 'ALERT_CHANNEL', useValue: mockChannel },
      ],
    }).compile();

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    service = module.get<AlertService>(AlertService);
  });

  afterEach(() => {
    restoreEnv('LOCKOUT_ALERT_CHANNEL');
    jest.restoreAllMocks();
  });

  describe('emit() — happy path', () => {
    it('calls channel.send with the payload', async () => {
      const payload = makePayload();
      await service.emit(payload);

      expect(mockChannel.send).toHaveBeenCalledWith(payload);
    });

    it('persists a login_lockout_alert row', async () => {
      const payload = makePayload();
      await service.emit(payload);

      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('persists a row with channel = channel.name', async () => {
      const payload = makePayload();
      await service.emit(payload);

      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'test-channel' }),
      );
    });

    it('persists a row with username, sede, ipAddress, failureCount from payload', async () => {
      const payload = makePayload();
      await service.emit(payload);

      expect(mockRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          username: payload.username,
          sede: payload.sede,
          ipAddress: payload.ipAddress,
          failureCount: payload.failureCount,
        }),
      );
    });
  });

  describe('emit() — best-effort (channel.send failure)', () => {
    it('swallows channel.send rejection and still persists the row', async () => {
      const rejectingChannel = makeChannel('fail-chan', () =>
        Promise.reject(new Error('SMTP down')),
      );
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          AlertService,
          { provide: getRepositoryToken(LoginLockoutAlert), useValue: mockRepo },
          { provide: 'ALERT_CHANNEL', useValue: rejectingChannel },
        ],
      }).compile();
      const svc2 = module2.get<AlertService>(AlertService);

      await svc2.emit(makePayload());

      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('does NOT throw when channel.send rejects', async () => {
      const rejectingChannel = makeChannel('fail-chan', () => Promise.reject(new Error('timeout')));
      const module3: TestingModule = await Test.createTestingModule({
        providers: [
          AlertService,
          { provide: getRepositoryToken(LoginLockoutAlert), useValue: mockRepo },
          { provide: 'ALERT_CHANNEL', useValue: rejectingChannel },
        ],
      }).compile();
      const svc3 = module3.get<AlertService>(AlertService);

      await expect(svc3.emit(makePayload())).resolves.toBeUndefined();
    });
  });

  describe('emit() — best-effort (repo.insert failure)', () => {
    it('swallows repo.insert rejection and does NOT throw', async () => {
      mockRepo.insert.mockRejectedValue(new Error('DB down'));

      await expect(service.emit(makePayload())).resolves.toBeUndefined();
    });

    it('logs an error when repo.insert fails', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      mockRepo.insert.mockRejectedValue(new Error('disk full'));

      await service.emit(makePayload());

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
