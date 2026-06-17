import { z } from 'zod';

export enum UserRole {
  Admin = 'admin',
  Cashier = 'cashier',
}

export const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});
export type AuthUser = z.infer<typeof authUserSchema>;
