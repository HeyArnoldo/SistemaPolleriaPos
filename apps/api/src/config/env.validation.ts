import { z } from 'zod';

const boolFlag = (defaultValue: boolean) =>
  z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default(defaultValue);

// Schema de variables de entorno. Se valida una sola vez al arrancar:
// si falta algo requerido, la API no levanta (mejor fallar temprano).
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),

    API_PORT: z.coerce.number().int().positive().default(3000),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),

    AUTH_LOCAL_ENABLED: boolFlag(true),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
    JWT_EXPIRES_IN: z.string().min(1).default('7d'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    COOKIE_SECURE: boolFlag(false),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),

    // Google OAuth: opcional. Si CLIENT_ID + CLIENT_SECRET existen, se activa solo.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),

    // Admin inicial (seed).
    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_NAME: z.string().optional(),

    // Carbopuntos hub integration (optional — if absent, points are disabled for this sede).
    CARBOPUNTOS_HUB_URL: z.string().url().optional().or(z.literal('')),
    CARBOPUNTOS_SERVICE_KEY: z.string().optional(),
    STORE_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // STORE_ID es clave para la unicidad de la idempotencyKey entre sedes (D15).
    // Si el hub está configurado pero falta STORE_ID, dos sedes podrían generar
    // la misma key y el hub doble-aplicaría operaciones. Lo exigimos al boot.
    if (env.CARBOPUNTOS_HUB_URL && !env.STORE_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORE_ID'],
        message: 'STORE_ID es obligatorio cuando CARBOPUNTOS_HUB_URL está configurado (D15)',
      });
    }
    // Sin SERVICE_KEY el módulo inyecta el cliente del hub como null, pero el
    // CarbopuntosProxyController lo usa como NO-opcional → 500 ante misconfig.
    // Lo exigimos al boot para fallar temprano en vez de en runtime.
    if (env.CARBOPUNTOS_HUB_URL && !env.CARBOPUNTOS_SERVICE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CARBOPUNTOS_SERVICE_KEY'],
        message:
          'CARBOPUNTOS_SERVICE_KEY es obligatorio cuando CARBOPUNTOS_HUB_URL está configurado',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

// Usado por ConfigModule.forRoot({ validate })
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
