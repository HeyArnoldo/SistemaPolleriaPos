# Design — cambio `carbopuntos`

> Fuente de verdad completa: `docs/CARBOPUNTOS-ANALISIS.md` (arquitectura, modelo de datos,
> límite de dominio, offline-first, multi-empresa). Este documento resume las decisiones de diseño
> técnico para guiar la implementación.

---

## 1. Arquitectura general

El saldo de puntos es dinero gastable y debe ser consistente entre las tres sedes. Se adopta un
**hub central** como único dueño del dato de fidelización.

```
┌──────────────────────────────────────────────────────────────┐
│  Monorepo pnpm                                               │
│                                                              │
│  packages/                                                   │
│    carbopuntos-contracts/   ← @app/carbopuntos-contracts     │
│    carbopuntos-client/      ← @app/carbopuntos-client        │
│                                                              │
│  apps/                                                       │
│    carbopuntos/             ← hub NestJS + DB propia         │
│    api/                     ← POS por sede (consume client)  │
│    web/                     ← frontend (caja + admin)        │
│    desktop/                 ← Electron (sin cambios)         │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Flujo de datos:
  apps/web  →  apps/api (por sede)  →  apps/carbopuntos (hub)
                    ↑                        ↑
            DB local de sede          DB propia del hub
```

Alternativas descartadas:

- **Replicación entre sedes**: riesgo de doble gasto (inaceptable para saldo canjeable).
- **Hub como módulo de apps/api**: mezcla dominio local con dominio compartido; viola RNF-20.
- **Repositorio separado**: fricción en cambios de contrato; contradice el requisito de repo único.

Referencia completa: `docs/CARBOPUNTOS-ANALISIS.md` §3 y §4.

---

## 2. Paquetes nuevos

### 2.1 `@app/carbopuntos-contracts`

Único origen de verdad del contrato de cable entre sedes y hub. Patrón idéntico a
`@app/contracts`: tsup, barrel `dist/index.*`, consumido vía `workspace:*`.

Módulos:

- `customer` — afiliar, buscar, obtener (DNI 8 dígitos, teléfono opcional, consentimiento)
- `dni` — request/response de json.pe
- `movement` — movimiento inmutable (tipo, puntos, saldo antes/después, sede, refs, idempotencyKey, voided)
- `balance` — saldo actual y proyectado
- `operations` — accrue, redeem, mixedOperation, reverse, adjust, voidMovement
- `reward` — config local por sede (nombre, costoPuntos, activo)

Regla de contratos: `z.coerce.number()` para puntos (pueden llegar como string por TypeORM).

### 2.2 `@app/carbopuntos-client`

Cliente HTTP tipado que cada sede usa para hablar con el hub. Construido sobre los contratos.
Aquí vive una sola vez: autenticación, timeouts, degradación elegante.

Comportamiento de degradación: si el hub no responde en 3–5 s, lanzar error tipado
`CarbopuntosUnavailableError` que `apps/api` convierte en "operación sin puntos" sin bloquear la venta.

Métodos: `lookupOrAffiliate`, `getBalance`, `search`, `getHistory`, `accrue`, `redeem`,
`operation`, `reverse`, `adjust`, `voidMovement`.

---

## 3. Hub `apps/carbopuntos`

NestJS con el mismo scaffolding que `apps/api`:

- `ConfigModule`, `TypeOrmModule`, `ZodValidationPipe`, prefijo `/api`
- `/health` excluido del prefijo
- `docker-entrypoint.sh` con `migration:run` antes de arrancar

### 3.1 Modelo de datos del hub

Base de datos propia del hub. `synchronize: false`, snake_case, decimales como string,
`timestamptz` en `America/Lima`.

**Customer**

```
id             uuid PK
dni            varchar(8) UNIQUE NOT NULL
first_name     varchar NOT NULL
last_name      varchar NOT NULL
full_name      varchar NOT NULL          -- tal cual de json.pe (RN-05)
phone          varchar NULL              -- opcional, no único (D23)
consent_at     timestamptz NOT NULL      -- consentimiento requerido (D10)
is_active      boolean DEFAULT true
created_at     timestamptz DEFAULT now()
```

**PointsBalance**

```
id             uuid PK
customer_id    uuid UNIQUE FK→Customer
balance        integer DEFAULT 0         -- nunca negativo (D6)
version        integer DEFAULT 0         -- optimistic locking (D17)
updated_at     timestamptz
```

**PointsMovement** (inmutable)

```
id              uuid PK
customer_id     uuid FK→Customer
type            enum('accrual','redeem','adjustment','reversal')
points          integer NOT NULL          -- positivo o negativo según el tipo
balance_before  integer NOT NULL
balance_after   integer NOT NULL
sede            varchar NOT NULL           -- de qué sede viene (D14)
user_ref        varchar NOT NULL           -- usuario de la sede (referencia débil)
sale_ref        varchar NULL               -- saleNumber de la sede (ref débil)
detail          varchar NULL
idempotency_key varchar UNIQUE             -- {saleNumber,sede,tipo} (D15)
is_voided       boolean DEFAULT false
voided_by       varchar NULL              -- admin que anuló
voided_at       timestamptz NULL
void_reason     varchar NULL
created_at      timestamptz DEFAULT now()
```

**AdminAudit** (inmutable)

```
id            uuid PK
action        enum('adjust','void')
actor_ref     varchar NOT NULL           -- usuario admin de la sede
sede          varchar NOT NULL
customer_id   uuid FK→Customer
movement_id   uuid NULL FK→PointsMovement
balance_before integer NOT NULL
balance_after  integer NOT NULL
reason        varchar NOT NULL           -- motivo obligatorio (D8/D25)
payload       jsonb NULL                 -- contexto extra
created_at    timestamptz DEFAULT now()
```

**SedeCredential**

```
id                uuid PK
sede              varchar UNIQUE NOT NULL
service_key_hash  varchar NOT NULL       -- bcryptjs del service key
is_active         boolean DEFAULT true
```

> El catálogo de premios **no** es entidad del hub (D2). Vive en `apps/api` de cada sede.

Referencia completa: `docs/CARBOPUNTOS-ANALISIS.md` §6.

### 3.2 Seguridad servicio-a-servicio

`ServiceKeyGuard`: valida `Authorization: Bearer <service_key>` contra `SedeCredential`
(bcryptjs), deriva `sede` e inyecta en el request. Todos los endpoints del hub usan este guard.

Autenticación: cada sede recibe `CARBOPUNTOS_HUB_URL`, `CARBOPUNTOS_SERVICE_KEY` y `STORE_ID`
como variables de entorno. El hub identifica la sede por el service key, no por JWT de usuario.

### 3.3 Reglas transversales del hub

- **Optimistic locking**: `PointsBalance.version` se incrementa en cada operación de saldo.
  Conflicto → reintentar (máx. 3 veces) → error 409.
- **Idempotencia**: `idempotency_key` UNIQUE. Si ya existe → responder con el movimiento
  original (no error, no duplicado).
- **Saldo nunca negativo** (acumulación y redención): bloqueado a nivel de servicio.
  Reversa que excede → topar en 0 y registrar la diferencia en `detail` (D6).
- **Ajuste manual**: el admin puede aplicar un delta negativo (con motivo obligatorio), pero un
  ajuste que dejaría el saldo negativo se **bloquea** a nivel de servicio — el saldo nunca queda
  negativo (D6/D8/D12 de DECISIONES).
- **Transacciones**: toda operación que modifica `PointsBalance` + `PointsMovement` + `AdminAudit`
  usa `repo.manager.transaction(...)` (mismo patrón que `createSale` en `apps/api`).

---

## 4. Integración en `apps/api` (mínima)

Cambios de esquema (con migración, `synchronize:false`):

**Product** — agregar columna `puntaje integer DEFAULT 0` (D3)

**Reward** — entidad local nueva por sede:

```
id           uuid PK
name         varchar NOT NULL
cost_points  integer NOT NULL
is_active    boolean DEFAULT true
created_at   timestamptz
```

**Sale** — agregar columna `customer_dni varchar(8) NULL` (referencia débil, sin FK — D20)

Flujo de acumulación en `createSale()`:

1. Si `customer_dni` presente → calcular `Σ(puntaje × qty)` sobre las líneas.
2. Llamar `client.accrue(...)` con `idempotencyKey = {saleNumber, sede, 'accrual'}`.
3. Si falla con `CarbopuntosUnavailableError` → encolar en tabla de pendientes, no bloquear la venta.

Flujo de reversa en `cancelSale()`:

1. Si la venta tiene `customer_dni` → llamar `client.reverse(saleRef)`.
2. Fallo → encolar pendiente.

Cola de pendientes (D16): tabla local `carbopuntos_pending_movement` + reintento al reconectar
(hook del endpoint `/sales/sync` existente). Backoff exponencial; tras N intentos, `status='failed'`
visible para el admin.

---

## 5. Frontend `apps/web`

Estructura nueva (no modifica archivos existentes; solo agrega):

```
services/
  carbopuntos.api.ts
hooks/
  use-customers.ts
  use-points.ts
pages/
  clientes.tsx            -- admin: listado, detalle, historial cross-sede, ajuste, anular
components/
  CustomerPanel.tsx       -- buscador + afiliación + saldo en página de ventas
  PointsBlock.tsx         -- bloque Antes / Operación / Ahora del ticket
```

En `ventas.tsx`: agregar `CustomerPanel` con búsqueda/afiliación por DNI, puntos a ganar,
saldo proyectado en tiempo real, canje de premios (deshabilitado sin hub), confirmación explícita.

En `Productos` (admin): config `puntaje` por producto + CRUD del catálogo de premios.

Query keys nuevas en `hooks/query-keys.ts`: `['carbopuntos', 'customers']`, `['carbopuntos', 'balance', dni]`,
`['carbopuntos', 'history', dni]`, etc. Toda mutación de puntos llama a `invalidateFinancialQueries`
y además invalida las query keys de carbopuntos afectadas.

Removido del prototipo (D21/D22):

- UI de vencimiento de puntos (avisos, "vencen en X días", leyenda del ticket).
- Botón "Eliminar historial" (borrado masivo) → reemplazado por "Anular" por fila.

---

## 6. Multi-empresa (D24)

El código del hub es idéntico para todas las empresas. Lo que cambia es el despliegue:
cada empresa tiene su propia instancia del hub + su propio PostgreSQL.

Variables de entorno que parametrizan el hub por empresa:

- `DB_*` (su base de datos)
- `JSONPE_API_KEY` (su cuenta json.pe)
- Seed de `SedeCredential` con las sedes de esa empresa

El `sede` es único dentro de su hub, no global.

---

## 7. CI (`ci.yml`)

El pipeline debe construir `@app/carbopuntos-contracts` antes de lint y typecheck,
porque tanto el hub como `apps/api` importan ese paquete y el typecheck falla sin el build previo.

Orden resultante: `install --frozen-lockfile` → `build contracts` → `build carbopuntos-contracts`
→ `lint` → `typecheck` → `build apps` → `test`.

Los tests e2e con Postgres real (supertest) se corren localmente, no en CI. El CI corre
jest unit tests y vitest.
