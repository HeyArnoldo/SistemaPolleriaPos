# Convenciones de código

## Git / workflow (NO negociable)

- **Nunca pushear directo a `main`.** Siempre: rama → PR → CI en verde → merge (squash).
- Verificá la secuencia completa del CI **localmente** antes de pushear:
  `install --frozen-lockfile` · contracts build · `lint` · `typecheck` · `build` · `test`.
- **Commits convencionales** (commitlint). El **subject debe ir en minúsculas**
  (no sentence-case ni mayúsculas iniciales) — ej. `fix: lima timezone ...`, no
  `fix: Lima ...`. Las siglas en mayúscula (GMT-5) en el subject rompen el hook.
- Al agregar dependencias, **regenerar el lockfile** (`pnpm install --lockfile-only`)
  o el CI falla en `--frozen-lockfile`.
- `.claude/` está en `.gitignore`. Cuidado con `git add -A` (puede colar worktrees
  de sub-agentes como gitlinks).

## Backend (NestJS / TypeORM)

- **`synchronize: false`** siempre; cambios de esquema solo por migración.
- **Nombres de columna explícitos**: `@Column({ name: 'snake_case' })` en cada
  columna y `@JoinColumn({ name: '...' })`. No se usa `typeorm-naming-strategies`.
- **bcryptjs** (no `bcrypt` nativo) — sin bindings nativos, anda en Alpine/CI.
- **Validación con `ZodValidationPipe`** contra los schemas de `@app/contracts`.
  No usar DTOs de class-validator.
- **Guards:** `JwtAuthGuard` a nivel clase; `@UseGuards(RolesGuard) + @Roles(Role.Admin)`
  a nivel método para rutas admin. Importar `Role` de `common/enums/role.enum`.
- **No devolver `passwordHash`** al cliente (hay un helper `stripPasswordHash`).
- **Operaciones multi-tabla → transacción explícita** con
  `repo.manager.transaction(...)`, seteando los FK a mano (no confiar solo en el
  cascade). Ej.: `createSale` (ver DOMAINS.md), reset financiero.
- **Hashing de password:** se hashea en el controller/seed y se inserta con
  `createQueryBuilder().insert()`. NO hay `@BeforeInsert` en la entidad User
  (se removió por ser un trap de doble-hash).
- **Orden de rutas:** las rutas literales (`export/cash-report`, `reset/all`) van
  declaradas ANTES de las paramétricas (`:id`) para no chocar con `ParseIntPipe`.

## Frontend (React / TanStack Query)

- **Servicios api** en `services/*.api.ts`; **hooks** en `hooks/use-*.ts`.
- **`api`** (axios) tiene baseURL `${VITE_API_URL ?? ''}/api`. En dev, `/api` y
  `/health` se proxean a `localhost:3000` (ver `vite.config.ts`).
- **Coercionar decimales en la frontera**: `getProducts`/`getPaymentMethods`
  normalizan `price`/`commissionPercentage` a `Number(...)` (el tipo dice
  `number` pero el runtime trae string).
- **Invalidación de queries**: toda mutación de venta/gasto/reset usa
  `invalidateFinancialQueries(qc)` (en `hooks/query-keys.ts`) para refrescar
  ventas, egresos, `cash-dashboard` y todos los `bi-*`. No invalidar solo `['sales']`.
- **Fechas a la API**: mandar rangos con offset Lima `-05:00`, o fechas
  solo-fecha (`YYYY-MM-DD`) que el backend expande al día Lima.
- **Componentes shadcn/ui** en `components/ui`. Estilo de páginas: **claro**
  (cards blancas `border-slate-200/70 shadow-sm`, texto slate, acentos
  emerald/rose). El **único elemento oscuro** es el sidebar (global).

## Contratos (`packages/contracts`)

- Schemas Zod compartidos. **`pnpm --filter @app/contracts build`** antes de usar.
- Campos monetarios que pueden venir como string → `z.coerce.number()`
  (ej. `createSaleSchema` unitPrice/amount).
- Tras editar contratos, rebuild y verificar que ambos lados (API y web) compilen.

## Idioma

- **UI / copy / mensajes de error**: español neutro (sin voseo regional fuerte).
- **Identificadores, código, comentarios técnicos**: inglés.
- **Docs / README**: español neutro (convención de este repo).
