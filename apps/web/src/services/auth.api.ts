import { api } from '@/lib/api';
import type {
  AuthUser,
  LoginInput,
  TwoFactorChallengeResponse,
  Login2faInput,
  EnrollResponse,
  ConfirmEnrollInput,
  EnrollConfirmed,
} from '@app/contracts';

export const authApi = {
  login: async (input: LoginInput): Promise<AuthUser | TwoFactorChallengeResponse> =>
    (await api.post<AuthUser | TwoFactorChallengeResponse>('/auth/login', input)).data,

  login2fa: async (input: Login2faInput): Promise<AuthUser> =>
    (await api.post<AuthUser>('/auth/login/2fa', input)).data,

  me: async (): Promise<AuthUser> => (await api.get<AuthUser>('/auth/me')).data,

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  enroll2fa: async (): Promise<EnrollResponse> =>
    (await api.post<EnrollResponse>('/auth/2fa/enroll')).data,

  confirm2fa: async (input: ConfirmEnrollInput): Promise<EnrollConfirmed> =>
    (await api.post<EnrollConfirmed>('/auth/2fa/enroll/confirm', input)).data,
};
