import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/auth.api';

const ME_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: authApi.me,
    retry: false,
  });
}

/**
 * Step-1 login mutation.
 *
 * On success the response is either:
 *   - an AuthUser  → sets the ME cache (the user is now logged in)
 *   - a TwoFactorChallengeResponse → does NOT touch the cache; the caller must
 *     detect `twoFactorRequired` and present the code-entry screen.
 */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      if (!('twoFactorRequired' in data)) {
        qc.setQueryData(ME_KEY, data);
      }
    },
  });
}

/**
 * Step-2 login mutation (TOTP code entry).
 * Consumes a short-lived challengeToken and a 6-digit TOTP code.
 * On success the API issues the app_session cookie and returns AuthUser.
 */
export function useLogin2fa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.login2fa,
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => qc.clear(),
  });
}

/**
 * Begins a TOTP enrollment for the currently authenticated user.
 * Returns { otpauthUri, secret } — secret is only available in this response.
 */
export function useEnroll2fa() {
  return useMutation({ mutationFn: authApi.enroll2fa });
}

/**
 * Confirms TOTP enrollment with a live 6-digit code.
 * On success the backend sets totpEnabled=true for the current user.
 */
export function useConfirmEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.confirm2fa,
    onSuccess: () => {
      // Refresh ME so totpEnabled reflects true in the UI
      void qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
