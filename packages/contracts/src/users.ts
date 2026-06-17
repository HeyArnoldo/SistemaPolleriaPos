import { z } from 'zod';
import { UserRole } from './auth';

export const createProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  avatarUrl: z.string().max(255).nullable().optional(),
});
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const createUserSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9]+$/, 'Solo alfanumérico, sin espacios'),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).optional(),
  profile: createProfileSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.omit({ profile: true }).partial().extend({
  profile: createProfileSchema.partial().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
