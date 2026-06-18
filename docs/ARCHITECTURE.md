# Arquitectura

## Stack

- **Backend:** NestJS 11 + TypeORM 0.3 + PostgreSQL 16
- **Frontend:** React 19 + Vite 7 + Tailwind v4 + shadcn/ui + TanStack Query v5
- **Desktop:** Electron 36 (envuelve la web, impresión silenciosa de tickets)
- **Contratos:** Zod compartidos entre API y web
- **Monorepo:** pnpm 11 con workspaces; commits convencionales (commitlint)

## Estructura del monorepo

```
SistemaPolleriaPos/
├── apps/
│   ├── api/         NestJS — auth, users, inventory, sales, cash, settings
│   ├── web/         React — pages, components, hooks, services, lib
│   └── desktop/     Electron — main.ts (IPC impresión + config), preload.ts
├── packages/
│   ├── contracts/   Schemas Zod compartidos (API ↔ web). build antes de usar.
│   └── tsconfig/    Config TS base compartida
├── docs/            Esta documentación
├── CLAUDE.md        Punto de entrada / mapa
├── docker-compose.yml        PostgreSQL para desarrollo
└── docker-compose.prod.yml   Stack para verificación local de Dockerfiles
```

## Flujo de datos (request típico)

```
Componente React (botón)
  → service api (apps/web/src/services/*.api.ts)   ← axios, baseURL ${VITE_API_URL}/api
  → hook TanStack Query (apps/web/src/hooks/use-*.ts)
  → ruta NestJS (apps/api/src/<dominio>/*.controller.ts)   ← prefijo global /api
  → ZodValidationPipe (valida contra packages/contracts)
  → service (apps/api/src/<dominio>/services/*.ts)
  → entidad TypeORM (apps/api/src/<dominio>/entities/*.ts) → PostgreSQL
```

Detalles importantes del flujo:

- **Prefijo `/api`:** `app.setGlobalPrefix('api', { exclude: ['health'] })` en
  `apps/api/src/main.ts`. Todo cuelga de `/api/*` EXCEPTO `/health` (lo usa el
  healthcheck de Docker/Coolify). El frontend pega health con baseURL override.
- **Auth:** JWT en cookie httpOnly. El frontend nunca toca el token. Login por
  **username** (no email); no hay registro público.
- **Decimales:** las columnas `decimal` de TypeORM se serializan como **string**.
  Hay que coercionar a número en la frontera (ver GOTCHAS.md).

## Persistencia y migraciones

- `synchronize: false` SIEMPRE. El esquema nunca se modifica solo.
- Cada cambio de entidad → migración explícita (`pnpm migration:generate ...`),
  revisar el SQL, luego `pnpm migration:run`.
- El `docker-entrypoint.sh` de la API corre `migration:run → seed → node dist/main.js`.
- El seed es idempotente (crea admin + métodos de pago + productos de ejemplo).

## Deploy

- Producción en **Coolify** (cada app se despliega con su propio Dockerfile).
- El servicio **web** necesita `VITE_API_URL` como **Build Variable** (Vite la
  hornea en el bundle en build-time, no runtime).
- El servicio **API** necesita las env vars de runtime (DB, JWT, CORS, etc.).
- Tras mergear a `main`, **redeploy desde `main`** en Coolify para ver los cambios.

## Comandos clave

```
pnpm --filter @app/contracts build   # requerido antes del primer arranque
pnpm dev                             # API + web en paralelo
pnpm lint && pnpm typecheck && pnpm build && pnpm test   # secuencia del CI
pnpm migration:run | migration:generate <ruta> | seed
```

## CI

`.github/workflows/ci.yml` corre en orden: `install --frozen-lockfile` →
contracts build → `lint` → `typecheck` → `build` → `test`. Replicá esa secuencia
localmente antes de pushear. `pnpm test` corre jest (api) + vitest (web).
