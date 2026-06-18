import '../../config/load-env';
import * as bcrypt from 'bcryptjs';
import dataSource from '../../config/typeorm.config';
import { SedeCredential } from '../../auth/entities/sede-credential.entity';

/**
 * Seed idempotente de SedeCredential.
 * Las claves de sede se leen desde variables de entorno (nunca hardcodeadas).
 * Si la variable de entorno para una sede no está definida, se omite esa sede.
 *
 * Variables esperadas:
 *   SEDE_KEY_URUBAMBA, SEDE_KEY_PISAC, SEDE_KEY_CALCA
 *   BCRYPT_ROUNDS (opcional, default 12)
 */
async function run(): Promise<void> {
  await dataSource.initialize();

  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
  const repo = dataSource.getRepository(SedeCredential);

  // Sedes predefinidas para Pollería Carbón.
  const sedes: Array<{ sede: string; envKey: string }> = [
    { sede: 'urubamba', envKey: 'SEDE_KEY_URUBAMBA' },
    { sede: 'pisac', envKey: 'SEDE_KEY_PISAC' },
    { sede: 'calca', envKey: 'SEDE_KEY_CALCA' },
  ];

  for (const { sede, envKey } of sedes) {
    const plainKey = process.env[envKey];

    if (!plainKey) {
      console.log(`[seed] ${envKey} no definida — omitiendo sede: ${sede}`);
      continue;
    }

    const existing = await repo.findOne({ where: { sede } });

    if (!existing) {
      const serviceKeyHash = await bcrypt.hash(plainKey, rounds);
      await repo.save(repo.create({ sede, serviceKeyHash, isActive: true }));
      console.log(`[seed] sede_credential creada: ${sede}`);
    } else {
      console.log(`[seed] sede_credential ya existe: ${sede}`);
    }
  }

  await dataSource.destroy();
  console.log('[seed] done.');
}

run().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
