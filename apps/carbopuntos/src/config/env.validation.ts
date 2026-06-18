import { z } from 'zod';

// Schema de variables de entorno del hub carbopuntos.
// Si falta algo requerido, el hub no levanta (fail-fast).
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  HUB_PORT: z.coerce.number().int().positive().default(3100),

  // Claves de las sedes (se usan en el seed — se hashean con bcryptjs).
  // Formato: clave plana desde env, nunca hardcodeada en código.
  SEDE_KEY_URUBAMBA: z.string().optional(),
  SEDE_KEY_PISAC: z.string().optional(),
  SEDE_KEY_CALCA: z.string().optional(),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

export type Env = z.infer<typeof envSchema>;

// Usado por ConfigModule.forRoot({ validate }).
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
