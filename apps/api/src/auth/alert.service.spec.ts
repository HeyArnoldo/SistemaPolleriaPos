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
  let mockRepo: { insert: jest.Mock; count: jest.Mock };
  let mockChannel: AlertChannel;

  beforeEach(async () => {
    saveEnv('LOCKOUT_ALERT_CHANNEL');
    delete process.env.LOCKOUT_ALERT_CHANNEL;

    mockRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
    };
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

  describe('emit() — dedupe within lockout window (CP-02)', () => {
    it('no reenvía alerta si ya existe una en la ventana de bloqueo', async () => {
      // Stateful in-memory repo: insert appends a row; count reflects existing
      // rows so the dedupe check sees prior alerts within the window.
      const rows: Array<{ username: string; createdAt: Date }> = [];
      const statefulRepo = {
        insert: jest.fn().mockImplementation((row: { username: string }) => {
          rows.push({ username: row.username, createdAt: new Date() });
          return Promise.resolve(undefined);
        }),
        count: jest.fn().mockImplementation(() => Promise.resolve(rows.length)),
      };
      const channel = makeChannel('test-channel');
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          AlertService,
          { provide: getRepositoryToken(LoginLockoutAlert), useValue: statefulRepo },
          { provide: 'ALERT_CHANNEL', useValue: channel },
        ],
      }).compile();
      const svc = module2.get<AlertService>(AlertService);

      // Four consecutive locked attempts for the same username in the window.
      for (let i = 0; i < 4; i++) {
        await svc.emit(makePayload());
      }

      // At most ONE persisted alert and one channel delivery for the episode.
      expect(statefulRepo.insert).toHaveBeenCalledTimes(1);
      expect(channel.send).toHaveBeenCalledTimes(1);
    });

    it('emits again for a different username (dedupe is per-username)', async () => {
      const rowsByUser = new Map<string, number>();
      const statefulRepo = {
        insert: jest.fn().mockImplementation((row: { username: string }) => {
          rowsByUser.set(row.username, (rowsByUser.get(row.username) ?? 0) + 1);
          return Promise.resolve(undefined);
        }),
        count: jest
          .fn()
          .mockImplementation((opts: { where: { username: string } }) =>
            Promise.resolve(rowsByUser.get(opts.where.username) ?? 0),
          ),
      };
      const channel = makeChannel('test-channel');
      const module3: TestingModule = await Test.createTestingModule({
        providers: [
          AlertService,
          { provide: getRepositoryToken(LoginLockoutAlert), useValue: statefulRepo },
          { provide: 'ALERT_CHANNEL', useValue: channel },
        ],
      }).compile();
      const svc = module3.get<AlertService>(AlertService);

      await svc.emit({ ...makePayload(), username: 'admin' });
      await svc.emit({ ...makePayload(), username: 'admin' });
      await svc.emit({ ...makePayload(), username: 'cajero1' });

      expect(statefulRepo.insert).toHaveBeenCalledTimes(2);
    });

    it('falls back to emitting when the dedupe count query throws (fail-open)', async () => {
      const failOpenRepo = {
        insert: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockRejectedValue(new Error('DB down')),
      };
      const channel = makeChannel('test-channel');
      const module4: TestingModule = await Test.createTestingModule({
        providers: [
          AlertService,
          { provide: getRepositoryToken(LoginLockoutAlert), useValue: failOpenRepo },
          { provide: 'ALERT_CHANNEL', useValue: channel },
        ],
      }).compile();
      const svc = module4.get<AlertService>(AlertService);

      await svc.emit(makePayload());

      expect(failOpenRepo.insert).toHaveBeenCalledTimes(1);
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
