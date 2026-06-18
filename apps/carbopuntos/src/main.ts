// PRIMERA línea: load-env lee process.env antes de que Nest arranque. No mover.
import './config/load-env';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de Traefik (Coolify): necesario para req.ip real.
  app.set('trust proxy', 1);

  // Todo cuelga de /api excepto /health (Docker healthcheck / Coolify).
  // La validación Zod se aplica por endpoint con ZodValidationPipe (patrón apps/api).
  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = parseInt(process.env.HUB_PORT ?? '3100', 10);
  await app.listen(port);
  console.log(
    `Hub carbopuntos corriendo en http://localhost:${port} (prefijo /api, health en /health)`,
  );
}

void bootstrap();
