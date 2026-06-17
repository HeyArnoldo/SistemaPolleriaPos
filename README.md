# SistemaPolleriaPos

POS (Punto de Venta) para **Pollería Carbón**. Monorepo pnpm con React 19 + NestJS 11 + PostgreSQL 16, Electron opcional para impresión nativa de tickets y queue offline con Dexie.

---

## Arquitectura

```
├── apps/
│   ├── api/        # NestJS 11 · TypeORM · JWT en cookie httpOnly · migraciones
│   ├── web/        # React 19 · Vite 7 · Tailwind v4 · shadcn/ui · TanStack Query
│   └── desktop/    # Electron 36 · wrapper del web con impresión silenciosa
├── packages/
│   ├── contracts/  # Schemas Zod compartidos — única fuente de verdad api ↔ web
│   └── tsconfig/   # Config TypeScript base
├── docker-compose.yml          # Postgres para desarrollo
├── docker-compose.prod.yml     # Stack completo para verificar Dockerfiles en local
└── apps/api/docker-entrypoint.sh  # migration:run → seed → node dist/main.js
```

**Roles:** `Admin` (acceso completo) · `Cashier` (ventas y egresos)

---

## Módulos

| Módulo        | Descripción                                                            |
| ------------- | ---------------------------------------------------------------------- |
| Ventas        | POS con carrito, métodos de pago múltiples, comisión por transferencia |
| Caja          | Historial de ventas por día, anulación, reporte Excel                  |
| Egresos       | Registro de gastos con comprobante                                     |
| Dashboard     | Resumen del día: ventas, egresos, total neto                           |
| Productos     | Catálogo con categorías, activar/desactivar                            |
| Usuarios      | Gestión de cajeros y admins                                            |
| Configuración | Métodos de pago, reset financiero                                      |

**Offline:** Dexie IndexedDB — si cae la conexión, ventas y egresos se encolan localmente y sincronizan al reconectarse. Badge en el header muestra items pendientes.

---

## Arrancar en desarrollo

```bash
cp .env.example .env        # ajusta JWT_SECRET y ADMIN_*

pnpm install
pnpm --filter @app/contracts build

pnpm db:up                  # Postgres en Docker
pnpm migration:run
pnpm seed                   # crea admin + cajero demo + 38 productos + métodos de pago

pnpm dev                    # api :3000, web :5173
```

Entra con el `ADMIN_USERNAME` / `ADMIN_PASSWORD` de tu `.env` (por defecto `admin` / `Admin1234!`).

---

## Scripts

| Comando                                                  | Qué hace                                        |
| -------------------------------------------------------- | ----------------------------------------------- |
| `pnpm dev`                                               | API + web en paralelo (watch)                   |
| `pnpm build`                                             | Build de todo (contracts → api → web → desktop) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`             | Calidad en todos los workspaces                 |
| `pnpm db:up` / `pnpm db:down`                            | Postgres en Docker                              |
| `pnpm migration:generate src/database/migrations/Nombre` | Genera migración desde entities                 |
| `pnpm migration:run` / `pnpm migration:revert`           | Aplica / revierte                               |
| `pnpm seed`                                              | Datos iniciales (idempotente)                   |

Adminer (UI de DB): `docker compose --profile tools up -d` → http://localhost:8081

---

## Deploy con Docker (sin Coolify)

Cada servidor solo necesita Docker. El entrypoint aplica migraciones y seed automáticamente en cada deploy:

```bash
# Verificar los Dockerfiles localmente
docker compose -f docker-compose.prod.yml up -d --build
# api → http://localhost:3000/health   web → http://localhost:8090

# En el servidor de producción
docker compose -f docker-compose.prod.yml up -d --build
```

**Variables de entorno requeridas en producción:**

```env
NODE_ENV=production
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=sistema_polleria_pos

CORS_ORIGIN=https://pos.midominio.com
FRONTEND_URL=https://pos.midominio.com

JWT_SECRET=<openssl rand -base64 32>
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

ADMIN_USERNAME=admin
ADMIN_PASSWORD=UnPasswordFuerte!

BCRYPT_ROUNDS=12
```

**Web — build arg** (queda horneado en el bundle):

```env
VITE_API_URL=https://api.midominio.com
```

---

## Electron (desktop)

```bash
cd apps/desktop
pnpm dev     # lanza Electron apuntando a http://localhost:8090
```

Después de cada venta, si la app corre dentro de Electron, imprime el ticket silenciosamente (sin diálogo). En el navegador se omite.

---

## Base de datos

`synchronize: false` está fijo — el esquema solo cambia con migraciones.

```bash
# 1. Modifica un *.entity.ts
# 2. Genera la migración
pnpm migration:generate src/database/migrations/NombreDescriptivo
# 3. Revisa el SQL generado
# 4. Aplica
pnpm migration:run
```

En producción, `docker-entrypoint.sh` corre `migration:run` + seed antes de arrancar la API.

---

## Calidad

- **Husky + lint-staged**: Prettier automático en cada commit
- **commitlint**: conventional commits (`feat:`, `fix:`, etc.) — el subject debe ser lowercase
- **GitHub Actions**: lint → typecheck → build → test en cada push/PR
- **TypeScript estricto** en todo el monorepo

---

## Decisiones técnicas

- **bcryptjs** (JS puro): sin bindings nativos, funciona en Alpine/CI
- **Contratos Zod compartidos**: el mismo schema valida el body en la API (`ZodValidationPipe`) y el formulario en el frontend (`zodResolver`)
- **No `typeorm-naming-strategies`**: `name:` explícito en todos los `@Column` y `@JoinColumn`
- **Auth por username**: no por email — adecuado para un POS interno sin registro público
- **Cookie httpOnly**: el frontend nunca toca el JWT; inmune a XSS
- **pnpm 11 pineado**: `pnpm-workspace.yaml` declara `allowBuilds` para esbuild, tailwind oxide y electron
