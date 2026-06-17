import { api } from '@/lib/api';
import type { AuthUser, LoginInput } from '@app/contracts';

export const authApi = {
  login: async (input: LoginInput): Promise<AuthUser> =>
    (await api.post<AuthUser>('/auth/login', input)).data,
  me: async (): Promise<AuthUser> => (await api.get<AuthUser>('/auth/me')).data,
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};
