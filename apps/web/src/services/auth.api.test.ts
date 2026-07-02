/**
 * Unit tests for auth API service — 2FA endpoints (CP-12 PR-b).
 *
 * Verifies that the service functions call the correct HTTP paths with the
 * correct payloads.  The `api` module is mocked so no real HTTP is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api';
import { authApi } from '@/services/auth.api';
import type {
  AuthUser,
  TwoFactorChallengeResponse,
  EnrollResponse,
  EnrollConfirmed,
} from '@app/contracts';
import { UserRole } from '@app/contracts';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const makeAuthUser = (): AuthUser => ({
  id: 1,
  username: 'admin',
  role: UserRole.Admin,
  isActive: true,
  totpEnabled: false,
  profile: { firstName: 'Admin', lastName: 'User', avatarUrl: null },
  createdAt: new Date('2024-01-01'),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── login (non-2FA path) ────────────────────────────────────────────────────

describe('authApi.login', () => {
  it('POSTs to /auth/login and returns the user on success', async () => {
    const user = makeAuthUser();
    mockApi.post.mockResolvedValue({ data: user });

    const result = await authApi.login({ username: 'admin', password: 'pass' });

    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'pass',
    });
    expect(result).toEqual(user);
  });

  it('returns a TwoFactorChallengeResponse when 2FA is required', async () => {
    const challenge: TwoFactorChallengeResponse = {
      twoFactorRequired: true,
      challengeToken: 'eyJhbGciOiJIUzI1NiJ9.challenge',
    };
    mockApi.post.mockResolvedValue({ data: challenge });

    const result = await authApi.login({ username: 'admin2fa', password: 'pass' });

    expect(result).toEqual(challenge);
  });
});

// ─── login2fa ────────────────────────────────────────────────────────────────

describe('authApi.login2fa', () => {
  it('POSTs challengeToken + code to /auth/login/2fa and returns AuthUser', async () => {
    const user = makeAuthUser();
    mockApi.post.mockResolvedValue({ data: user });

    const result = await authApi.login2fa({
      challengeToken: 'eyJhbGciOiJIUzI1NiJ9.challenge',
      code: '123456',
    });

    expect(mockApi.post).toHaveBeenCalledWith('/auth/login/2fa', {
      challengeToken: 'eyJhbGciOiJIUzI1NiJ9.challenge',
      code: '123456',
    });
    expect(result).toEqual(user);
  });
});

// ─── enroll2fa ───────────────────────────────────────────────────────────────

describe('authApi.enroll2fa', () => {
  it('POSTs to /auth/2fa/enroll and returns otpauthUri + secret', async () => {
    const enrollData: EnrollResponse = {
      otpauthUri:
        'otpauth://totp/Polleriar%20Carb%C3%B3n%20POS%3Aadmin?secret=BASE32SECRET&issuer=Poller%C3%ADa%20Carb%C3%B3n%20POS',
      secret: 'BASE32SECRET',
    };
    mockApi.post.mockResolvedValue({ data: enrollData });

    const result = await authApi.enroll2fa();

    expect(mockApi.post).toHaveBeenCalledWith('/auth/2fa/enroll');
    expect(result).toEqual(enrollData);
  });
});

// ─── confirm2fa ──────────────────────────────────────────────────────────────

describe('authApi.confirm2fa', () => {
  it('POSTs the 6-digit code to /auth/2fa/enroll/confirm', async () => {
    const confirmed: EnrollConfirmed = { enabled: true };
    mockApi.post.mockResolvedValue({ data: confirmed });

    const result = await authApi.confirm2fa({ code: '654321' });

    expect(mockApi.post).toHaveBeenCalledWith('/auth/2fa/enroll/confirm', { code: '654321' });
    expect(result).toEqual(confirmed);
  });
});
