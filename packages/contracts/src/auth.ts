import { z } from 'zod';

export enum UserRole {
  Admin = 'admin',
  Cashier = 'cashier',
}

// ─── TOTP enrollment contracts (CP-12 / PR-a1) ────────────────────────────────

/** POST /auth/2fa/enroll → { otpauthUri, secret } */
export const enrollResponseSchema = z.object({
  otpauthUri: z.string().url(),
  secret: z.string().min(1), // base32 for manual entry
});
export type EnrollResponse = z.infer<typeof enrollResponseSchema>;

/** POST /auth/2fa/enroll/confirm { code } */
export const confirmEnrollSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: 'Code must be exactly 6 digits' }),
});
export type ConfirmEnrollInput = z.infer<typeof confirmEnrollSchema>;

/** POST /auth/2fa/enroll/confirm → { enabled: true } */
export const enrollConfirmedSchema = z.object({ enabled: z.literal(true) });
export type EnrollConfirmed = z.infer<typeof enrollConfirmedSchema>;

/** POST /auth/2fa/reset (admin only) */
export const resetTotpSchema = z.object({
  userId: z.number().int().positive(),
});
export type ResetTotpInput = z.infer<typeof resetTotpSchema>;

export const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ─── TOTP login enforcement contracts (CP-12 / PR-a2) ────────────────────────

/**
 * POST /auth/login/2fa { challengeToken, code }
 * Completes the second step of two-factor login.
 */
export const login2faSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, { message: 'Code must be exactly 6 digits' }),
});
export type Login2faInput = z.infer<typeof login2faSchema>;

/**
 * Response when POST /auth/login yields a 2FA challenge (user has totpEnabled=true).
 * No session cookie is set at this point.
 */
export const twoFactorChallengeResponseSchema = z.object({
  twoFactorRequired: z.literal(true),
  challengeToken: z.string(),
});
export type TwoFactorChallengeResponse = z.infer<typeof twoFactorChallengeResponseSchema>;

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean(),
  totpEnabled: z.boolean(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  createdAt: z.coerce.date(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
