# Hub CARBOPUNTOS (`@app/carbopuntos`)

Servicio central de fidelización (clientes + puntos) compartido entre las sedes de **una empresa**.
Corre como servicio aparte, con su **propia base de datos PostgreSQL**. Es el único dueño del saldo de
puntos. Cada empresa despliega su propio hub (ver `docs/CARBOPUNTOS-ANALISIS.md` §12).

> El sandbox de este repo bloquea archivos `.env*`, por eso el template de variables vive aquí.
> Copia el bloque de abajo a `apps/carbopuntos/.env` y completa los valores.

## Variables de entorno

```bash
NODE_ENV=development            # development | production | test

# Base de datos PROPIA del hub (NO es la base de ninguna sede).
DB_HOST=localhost
DB_PORT=5433                    # 5433 si usas el servicio carbopuntos-db del docker-compose
DB_USER=app
DB_PASSWORD=app
DB_NAME=carbopuntos

# Puerto HTTP del hub. La API queda bajo el prefijo /api.
HUB_PORT=3100

# API key de json.pe para validar DNI (D12). Solo el hub la usa.
JSONPE_API_KEY=

# Claves de servicio por sede (texto plano; el seed las hashea con bcrypt).
# La MISMA clave plana va en CARBOPUNTOS_SERVICE_KEY del POS de esa sede.
# Si una sede no tiene clave definida, el seed la omite.
SEDE_KEY_URUBAMBA=
SEDE_KEY_PISAC=
SEDE_KEY_CALCA=

# Costo de hash bcrypt para las claves de sede (4-15).
BCRYPT_ROUNDS=12
```

`DB_*`, `DB_NAME` y `HUB_PORT` son obligatorias (el hub no levanta si faltan — fail-fast).

## Levantarlo en local

```bash
# 1. Postgres dedicada del hub (puerto 5433 para no chocar con la del POS):
docker compose --profile carbopuntos up -d carbopuntos-db

# 2. Con el .env completo en apps/carbopuntos:
pnpm --filter @app/carbopuntos-contracts build
pnpm --filter @app/carbopuntos build
pnpm --filter @app/carbopuntos migration:run   # crea el esquema
pnpm --filter @app/carbopuntos seed             # crea SedeCredential (hashea las SEDE_KEY_*)
pnpm --filter @app/carbopuntos start            # o `dev` para watch
```

En producción (Coolify) el `docker-entrypoint.sh` hace `migration:run → seed → start`
automáticamente; solo se cargan las variables de entorno.

## Cómo se conecta con cada sede

La misma clave vive en dos lados:

- **Hub**: `SEDE_KEY_URUBAMBA` (texto plano) → el seed la guarda hasheada en `SedeCredential`.
- **POS de la sede** (`apps/api`): esa misma clave plana en `CARBOPUNTOS_SERVICE_KEY`, y
  `CARBOPUNTOS_HUB_URL` apuntando al hub **incluyendo el prefijo `/api`**
  (ej. `http://localhost:3100/api`).

`STORE_ID` en el POS debe coincidir con el nombre de sede del hub (`urubamba`, `pisac`, `calca`) y es
obligatorio cuando `CARBOPUNTOS_HUB_URL` está configurado.

## Tests

- `pnpm --filter @app/carbopuntos test` — unitarios (sin Postgres; los corre el CI).
- `pnpm --filter @app/carbopuntos test:e2e` — e2e con Postgres real (local, fuera del CI); requiere
  `E2E_PG_URL` apuntando a una base de prueba.
