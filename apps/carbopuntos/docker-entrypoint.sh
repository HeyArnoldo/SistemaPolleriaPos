#!/bin/sh
set -e

echo "[entrypoint] Corriendo migraciones..."
node apps/carbopuntos/node_modules/typeorm/cli.js migration:run -d apps/carbopuntos/dist/config/typeorm.config.js

echo "[entrypoint] Corriendo seed (idempotente)..."
node apps/carbopuntos/dist/database/seeds/run-seed.js

echo "[entrypoint] Iniciando hub carbopuntos..."
exec node apps/carbopuntos/dist/main.js
