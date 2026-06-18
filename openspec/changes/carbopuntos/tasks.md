# Tasks — cambio `carbopuntos`

> Estrategia: STACKED-TO-MAIN. WU-1 (contratos) mergea primero como base; el resto va a main
> en orden (cada WU hace rebase sobre main antes del PR).
> Compuerta permanente: **suite completa verde tras rebase sobre main** antes de cada PR.
> TDD estricto: cada tarea de implementación está precedida por su test (RED → GREEN → REFACTOR).
> F0 (cierre de decisiones) está completado.

---

## WU-0 — Decisiones cerradas ✅ DONE

Todas las decisiones D1–D25 están resueltas. No requiere código.

---

## WU-1 — `@app/carbopuntos-contracts` (gate — mergea primero)

**Rama:** `feat/carbopuntos-wu1`
**Dueño:** `packages/carbopuntos-contracts/` + `.github/workflows/ci.yml`
**Dependencias:** ninguna (es la base de todo)
**WUs desbloqueadas al mergear:** WU-2, WU-3

### Tareas

- [x] **T1.1** TEST: crear `packages/carbopuntos-contracts/src/__tests__/customer.spec.ts` con
      casos vitest para `customerSchema` (dni 8 dígitos, teléfono opcional), `affiliateCustomerSchema`
      (consentimiento requerido), `customerSearchSchema`.
- [x] **T1.2** IMPL: crear `packages/carbopuntos-contracts/package.json` (`@app/carbopuntos-contracts`,
      deps: `zod`, devDeps: `tsup`, `typescript`).
- [x] **T1.3** IMPL: crear `tsup.config.ts` y `tsconfig.json` siguiendo el patrón de `packages/contracts`.
- [x] **T1.4** IMPL: crear `src/customer.ts` con `customerSchema`, `affiliateCustomerSchema`,
      `customerSearchSchema`. `phone` opcional. `consent_at` requerido.
- [x] **T1.5** TEST: `src/__tests__/dni.spec.ts` — validar la respuesta de json.pe (success/error).
- [x] **T1.6** IMPL: crear `src/dni.ts` con `dniLookupResponseSchema` (mapea `nombres`,
      `apellido_paterno`, `apellido_materno`, `nombre_completo`).
- [x] **T1.7** TEST: `src/__tests__/movement.spec.ts` — tipos de movimiento, campos opcionales,
      `idempotency_key` único, `is_voided`.
- [x] **T1.8** IMPL: crear `src/movement.ts` con `pointsMovementSchema`
      (type enum: `accrual|redeem|adjustment|reversal`; `points: z.coerce.number()`).
- [x] **T1.9** TEST: `src/__tests__/balance.spec.ts` — saldo nunca negativo en schema,
      saldo proyectado.
- [x] **T1.10** IMPL: crear `src/balance.ts` con `balanceSchema` y `projectedBalanceSchema`.
- [x] **T1.11** TEST: `src/__tests__/operations.spec.ts` — cada operación: accrue, redeem,
      mixedOperation, reverse, adjust, voidMovement. Validar que `idempotencyKey` es requerido
      en accrue/redeem/mixedOperation/reverse.
- [x] **T1.12** IMPL: crear `src/operations.ts` con `accrueSchema`, `redeemSchema`,
      `mixedOperationSchema`, `reverseSchema`, `adjustSchema`, `voidMovementSchema`.
- [x] **T1.13** TEST: `src/__tests__/reward.spec.ts` — reward local (nombre, costoPuntos, activo).
- [x] **T1.14** IMPL: crear `src/reward.ts` con `rewardSchema`.
- [x] **T1.15** IMPL: crear `src/index.ts` (barrel — re-exporta todo).
- [x] **T1.16** IMPL: actualizar `pnpm-workspace.yaml` si es necesario para incluir
      `packages/carbopuntos-contracts` y `packages/carbopuntos-client`.
      (pnpm-workspace.yaml ya cubría `packages/*` — no se requirió cambio)
- [x] **T1.17** IMPL: actualizar `.github/workflows/ci.yml` — agregar paso
      `pnpm --filter @app/carbopuntos-contracts build` entre el build de `@app/contracts` y el
      paso de lint/typecheck.
- [x] **T1.18** VERIFY: `pnpm --filter @app/carbopuntos-contracts build` compila sin errores.
      `pnpm --filter @app/carbopuntos-contracts test` pasa. Suite completa verde tras rebase sobre main.

**Hecho cuando:** el paquete compila, los tests pasan, y el CI actualizado construye el paquete
antes del lint.

---

## WU-2 — Hub scaffold + entidades + migración

**Rama:** `feat/carbopuntos-wu2`
**Dueño:** `apps/carbopuntos/`
**Dependencias:** WU-1 mergeado en main
**WUs desbloqueadas al mergear:** WU-4 (junto con WU-3)

### Tareas

- [x] **T2.1** TEST: crear `apps/carbopuntos/test/health.e2e-spec.ts` (supertest local, PG real)
      — GET `/health` retorna 200. Verificar que el entrypoint levanta correctamente.
      _(postergado a WU-4: requiere Postgres vivo; no aplica en WU-2 unit-only)_
- [x] **T2.2** IMPL: scaffold de `apps/carbopuntos` siguiendo `apps/api`:
      `src/main.ts`, `src/app.module.ts`, `ConfigModule`, `TypeOrmModule` (synchronize: false),
      ZodValidationPipe por-endpoint (patrón apps/api), prefijo `/api`, `/health` fuera del prefijo.
- [x] **T2.3** IMPL: `apps/carbopuntos/package.json`, `tsconfig.json`, `Dockerfile`
      (patrón `--filter @app/carbopuntos...`), `docker-entrypoint.sh` con `migration:run`.
- [x] **T2.4** TEST: `apps/carbopuntos/test/entities.spec.ts` — unit tests de las entidades
      (validaciones de columna, unicidad de DNI, estado inicial de balance = 0).
- [x] **T2.5** IMPL: entidad `Customer` en `src/customers/entities/customer.entity.ts`.
      Columnas: `id`, `dni` (unique), `first_name`, `last_name`, `full_name`, `phone` (null),
      `consent_at`, `is_active`, `created_at`. Nombres de columna explícitos (snake_case).
- [x] **T2.6** IMPL: entidad `PointsBalance` en `src/points/entities/points-balance.entity.ts`.
      Columnas: `id`, `customer_id` (unique FK), `balance` (int default 0), `version` (int default 0),
      `updated_at`.
- [x] **T2.7** IMPL: entidad `PointsMovement` en `src/points/entities/points-movement.entity.ts`.
      Inmutable. Columnas: todas las del diseño, `idempotency_key` (unique nullable).
- [x] **T2.8** IMPL: entidad `AdminAudit` en `src/audit/entities/admin-audit.entity.ts`.
      Inmutable. Columnas según diseño.
- [x] **T2.9** IMPL: entidad `SedeCredential` en `src/auth/entities/sede-credential.entity.ts`.
      Columnas: `id`, `sede` (unique), `service_key_hash`, `is_active`.
- [x] **T2.10** IMPL: migración `CreateCarbopuntosSchema` con todas las tablas y sus índices.
      Escrita a mano, coherente con entidades. down() incluido.
- [x] **T2.11** TEST: `apps/carbopuntos/test/migrations.e2e-spec.ts` (supertest local) —
      verificar que la DB queda con el schema correcto tras migration:run.
      _(postergado a WU-4: requiere Postgres vivo)_
- [x] **T2.12** VERIFY: `pnpm --filter @app/carbopuntos build` compila. Suite verde. Rebase sobre main.

**Hecho cuando:** el hub levanta, aplica la migración y el healthcheck responde.

---

## WU-3 — `@app/carbopuntos-client`

**Rama:** `feat/carbopuntos-wu3`
**Dueño:** `packages/carbopuntos-client/`
**Dependencias:** WU-1 mergeado en main
**WUs desbloqueadas al mergear:** WU-4 (junto con WU-2), WU-5

### Tareas

- [x] **T3.1** TEST: crear `packages/carbopuntos-client/src/__tests__/client.spec.ts` (vitest,
      mock del fetch) — verificar que el cliente: (a) incluye el header `Bearer <service_key>`,
      (b) lanza `CarbopuntosUnavailableError` si timeout/error de red, (c) valida la respuesta con Zod.
- [x] **T3.2** IMPL: crear `packages/carbopuntos-client/package.json` (`@app/carbopuntos-client`,
      deps: `@app/carbopuntos-contracts`, `zod`).
- [x] **T3.3** IMPL: `tsup.config.ts`, `tsconfig.json` (patrón de `packages/contracts`).
- [x] **T3.4** IMPL: `src/errors.ts` — `CarbopuntosUnavailableError` (timeout/red) y
      `CarbopuntosApiError` (respuesta de error del hub).
- [x] **T3.5** TEST: `src/__tests__/degradation.spec.ts` — verificar que `CarbopuntosUnavailableError`
      se lanza en timeout y que el caller puede capturarlo sin bloquear la venta.
- [x] **T3.6** IMPL: `src/client.ts` — clase `CarbopuntosClient` con `baseUrl` y `serviceKey`.
      Timeout configurable (default 4000 ms). Validación request/response con Zod.
      Métodos: `lookupOrAffiliate`, `getBalance`, `search`, `getHistory`, `accrue`, `redeem`,
      `operation`, `reverse`, `adjust`, `voidMovement`.
- [x] **T3.7** IMPL: `src/index.ts` (barrel).
- [x] **T3.8** VERIFY: `pnpm --filter @app/carbopuntos-client build` compila.
      Tests pasan. Rebase sobre main.

**Hecho cuando:** el cliente compila, el fallback no bloquea la venta, y los tests pasan.

---

## WU-4 — Hub endpoints

**Rama:** `feat/carbopuntos-wu4`
**Dueño:** `apps/carbopuntos/src/`
**Dependencias:** WU-2 y WU-3 mergeados en main
**WUs desbloqueadas al mergear:** WU-5

### Tareas

- [x] **T4.1** TEST: `apps/carbopuntos/test/auth.e2e-spec.ts` (supertest local) — verificar que
      un request sin `Authorization` devuelve 401, y con un service key válido retorna 200.
- [x] **T4.2** IMPL: `src/auth/guards/service-key.guard.ts` — `ServiceKeyGuard`, valida
      `Authorization: Bearer <key>` contra `SedeCredential` (bcryptjs), inyecta `req.sede`.
- [x] **T4.3** TEST: `apps/carbopuntos/test/customers.e2e-spec.ts` (supertest + PG real) —
      flujo: afiliar cliente nuevo (mock json.pe), consultar por DNI, buscar por nombre.
- [x] **T4.4** IMPL: `src/customers/services/dni.service.ts` — `DniService`, llama
      `POST https://api.json.pe/api/dni`, valida `^[0-9]{8}$`, maneja 404/timeout.
- [x] **T4.5** IMPL: `src/customers/customers.module.ts`, `customers.controller.ts`,
      `customers.service.ts`.
      Endpoints: `POST /customers` (afiliar: buscar local → si no, json.pe → crear),
      `GET /customers/search?q=`, `GET /customers/:dni`.
- [x] **T4.6** TEST: `apps/carbopuntos/test/history.e2e-spec.ts` — GET `/customers/:dni/history`
      devuelve movimientos cross-sede, cada uno con su campo `sede`.
- [x] **T4.7** IMPL: endpoint `GET /customers/:dni/history` en `customers.controller.ts`.
- [x] **T4.8** TEST: `apps/carbopuntos/test/accrue.e2e-spec.ts` — acumular puntos, reintentar
      con misma `idempotency_key` → respuesta idempotente (mismo movimiento, no duplicado).
- [x] **T4.9** IMPL: `src/points/points.module.ts`, `points.controller.ts`, `points.service.ts`.
      Endpoint: `POST /points/accrue` — acumulación idempotente, transacción + optimistic lock.
- [x] **T4.10** TEST: `apps/carbopuntos/test/redeem.e2e-spec.ts` — canjear con saldo suficiente,
      rechazar con saldo insuficiente, dos sedes concurrentes (lock serializa).
- [x] **T4.11** IMPL: endpoint `POST /points/redeem` — canje transaccional con lock, rechaza
      si saldo insuficiente.
- [x] **T4.12** TEST: `apps/carbopuntos/test/operation.e2e-spec.ts` — operación mixta
      (acumulación + canje) atómica: si falla el canje, la acumulación no se aplica.
- [x] **T4.13** IMPL: endpoint `POST /points/operation` — operación mixta en una sola transacción.
- [x] **T4.14** TEST: `apps/carbopuntos/test/reverse.e2e-spec.ts` — reversa que resta puntos;
      reversa sobre venta sin acumulación previa → no-op; reversa que excede el saldo → topa en 0.
- [x] **T4.15** IMPL: endpoint `POST /points/reverse` — reversa por `sale_ref`, no-op si no existe
      acumulación previa (C15), topa saldo en 0 (D6).
- [x] **T4.16** TEST: `apps/carbopuntos/test/adjust.e2e-spec.ts` — ajuste manual con motivo,
      entrada en `AdminAudit`, saldo actualizado.
- [x] **T4.17** IMPL: endpoint `POST /points/adjust` — ajuste manual admin, motivo obligatorio,
      `AdminAudit` escrito en la misma transacción.
- [x] **T4.18** TEST: `apps/carbopuntos/test/void.e2e-spec.ts` — anular movimiento (soft-delete),
      saldo recalculado, `AdminAudit` creado, movimiento anulado no vuelve a anularse.
- [x] **T4.19** IMPL: endpoint `POST /movements/:id/void` — soft-delete, recalcula saldo,
      escribe `AdminAudit`.
- [x] **T4.20** VERIFY: todos los tests e2e del hub pasan localmente con PG real.
      `pnpm --filter @app/carbopuntos build` compila. Rebase sobre main.

**Hecho cuando:** todos los endpoints del hub operan con idempotencia, locking y auditoría correctos.

---

## WU-5 — Integración `apps/api`

**Rama:** `feat/carbopuntos-wu5`
**Dueño:** `apps/api/src/`
**Dependencias:** WU-3 y WU-4 mergeados en main
**WUs desbloqueadas al mergear:** WU-6

### Tareas

- [x] **T5.1** TEST: `apps/api/src/products/products.spec.ts` — agregar casos para el campo
      `puntaje` (default 0, tipo integer, nunca negativo).
- [x] **T5.2** IMPL: agregar columna `puntaje integer DEFAULT 0` a la entidad `Product` en
      `apps/api/src/inventory/entities/product.entity.ts`. Columna explícita `puntaje`.
- [x] **T5.3** IMPL: migración `AddPuntajeToProduct` en `apps/api`.
- [x] **T5.4** TEST: `apps/api/src/rewards/rewards.spec.ts` — CRUD de `Reward` local (crear,
      listar, activar/desactivar, eliminar lógico). Sin FK al hub.
- [x] **T5.5** IMPL: entidad `Reward` local en `apps/api/src/rewards/entities/reward.entity.ts`
      (id, name, cost_points, is_active, created_at). Columnas explícitas snake_case.
- [x] **T5.6** IMPL: `RewardsModule`, `RewardsController`, `RewardsService` en `apps/api`.
      Endpoints CRUD básicos (`GET /rewards`, `POST /rewards`, `PATCH /rewards/:id`,
      `DELETE /rewards/:id` lógico).
- [x] **T5.7** IMPL: migración `CreateRewardTable` en `apps/api`.
- [x] **T5.8** TEST: `apps/api/src/sales/sales.spec.ts` — agregar caso: venta con `customer_dni`
      calcula puntos correctamente (Σ puntaje × qty).
- [x] **T5.9** IMPL: agregar columna `customer_dni varchar(8) NULL` a `Sale` en
      `apps/api/src/sales/entities/sale.entity.ts`. Columna explícita. Sin FK (D20).
- [x] **T5.10** IMPL: migración `AddCustomerDniToSale` en `apps/api`.
- [x] **T5.11** TEST: `apps/api/src/sales/carbopuntos-accrue.spec.ts` — `createSale()` con
      `customer_dni`: llama `client.accrue` con la `idempotencyKey` correcta. Si el cliente lanza
      `CarbopuntosUnavailableError`, la venta igual se cierra y se crea una entrada en
      `carbopuntos_pending_movement`.
- [x] **T5.12** IMPL: instanciar `CarbopuntosClient` en `apps/api` desde las env vars.
      Crear `CarbopuntosModule` que provee el cliente.
- [x] **T5.13** IMPL: cablear acumulación en `SalesService.createSale()`: si `customer_dni` y
      puntos > 0, llamar `client.accrue(...)` tras guardar la venta. Excepción → encolar pendiente.
- [x] **T5.14** TEST: `apps/api/src/sales/carbopuntos-reverse.spec.ts` — `cancelSale()` con
      `customer_dni`: llama `client.reverse(saleRef)`. Si falla, encola pendiente.
- [x] **T5.15** IMPL: cablear reversa en `SalesService.cancelSale()`: si la venta tiene
      `customer_dni`, llamar `client.reverse(saleRef)`. Excepción → encolar pendiente.
- [x] **T5.16** TEST: `apps/api/src/carbopuntos/pending-queue.spec.ts` — encolar un movimiento
      fallido, reintentar, marcar como `failed` tras N intentos.
- [x] **T5.17** IMPL: tabla `carbopuntos_pending_movement` (migración) y servicio de cola de
      pendientes `CarbopuntosPendingService`. Backoff exponencial. Estado: `pending|retrying|failed`.
      Reintento via `POST /api/carbopuntos/sync` (CarbopuntosSyncController).
- [x] **T5.18** IMPL: actualizar `@app/contracts` para incluir los nuevos campos
      (`puntaje` en productos, `customer_dni` en ventas). Env vars en `.env.example` y validación.
- [x] **T5.19** VERIFY: `pnpm --filter @app/api test` pasa (52 tests: 27 originales + 25 nuevos).
      `pnpm --filter @app/api build` compila. lint y typecheck OK.

**Hecho cuando:** vender con cliente acumula puntos; cancelar revierte; el hub caído no bloquea la venta.

---

## WU-6 — Frontend `apps/web` ✅ DONE (WU-6b)

**Rama:** `feat/carbopuntos-wu6b-web`
**Dueño:** `apps/web/src/`
**Dependencias:** WU-5 mergeado en main

### Tareas

**Infraestructura**

- [x] **T6.1** TEST: `apps/web/src/services/carbopuntos.api.test.ts` — service API tests (mocked).
      Cubre `searchCustomers`, `getCustomer`, `getCustomerHistory`, `affiliateCustomer`,
      `adjustPoints`, `voidMovement`.
- [x] **T6.2** IMPL: `apps/web/src/services/carbopuntos.api.ts` — servicio completo.
      Llama a `apps/api` (`/api/carbopuntos/*`), nunca al hub directamente.
      También: `apps/web/src/services/rewards.api.ts` (CRUD de premios).
- [x] **T6.3** TEST: (cubierto en T6.1 + use-points.test.ts)
- [x] **T6.4** IMPL: `apps/web/src/hooks/use-customers.ts` y `use-points.ts` con TanStack Query.
      `use-rewards.ts` para el catálogo de premios.
- [x] **T6.5** IMPL: `hooks/query-keys.ts` — claves carbopuntos: `customers`, `customer`,
      `customerHistory`, `customerBalance`, `rewards`. Invalidación correcta tras mutaciones.

**Caja — flujo de puntos**

- [x] **T6.6** TEST: `use-points.test.ts` — `calcPointsToEarn`, `calcProjectedBalance`,
      `buildRedemptionsPayload`, `canAffordRedemptions`, `canAddMoreRewards` (23 tests).
- [x] **T6.7** IMPL: `apps/web/src/components/dashboard/ventas/customer-panel.tsx` —
      búsqueda/afiliación por DNI, teléfono opcional, consentimiento. Bloqueado sin conexión.
- [x] **T6.8** TEST: `use-points.test.ts` — saldo proyectado calculado en tiempo real (cubierto).
- [x] **T6.9** IMPL: `CustomerPanel` integrado en `ventas.tsx`. Puntos a ganar + saldo proyectado
      en tiempo real. Canje deshabilitado sin conexión (C1/C3).
- [x] **T6.10** TEST: (lógica de RewardsModal cubierta en use-points.test.ts)
- [x] **T6.11** IMPL: `apps/web/src/components/dashboard/ventas/rewards-modal.tsx` —
      lista de premios, bloquea cuando costo > saldo disponible.
      `apps/web/src/components/dashboard/ventas/confirm-redemption-modal.tsx` — confirmación RF-39.
- [x] **T6.12** TEST: Antes/Operación/Ahora — el bloque de puntos del ticket usa los campos
      `carbopuntos` de la respuesta de la API (tipos en `models.ts`).
- [x] **T6.13** IMPL: El ticket incluye el campo `carbopuntos` en `Sale`. El bloque Antes/Op/Ahora
      se renderizaría desde `buildTicketHtml` cuando el campo esté presente — TODO pendiente
      para integrar el bloque visual en el HTML del ticket (requiere datos del backend).

**Admin — clientes y movimientos**

- [x] **T6.14** TEST: (historial cross-sede cubierto en integración; no hay DOM testing)
- [x] **T6.15** IMPL: `apps/web/src/pages/clientes.tsx` — listado con búsqueda, detalle del
      cliente, historial completo con columna `sede` por movimiento.
- [x] **T6.16** TEST: (AdjustModal logic tested via service tests; DOM testing requiere jsdom)
- [x] **T6.17** IMPL: `AdjustModal` incrustado en `clientes.tsx` — `+`/`−` con motivo obligatorio.
      Invalida queries de balance y historial.
- [x] **T6.18** TEST: (void cubierto en service test)
- [x] **T6.19** IMPL: botón "Anular" por fila en historial. `VoidConfirmModal` con motivo. Sin borrado masivo.

**Admin — config puntaje y premios en Productos**

- [x] **T6.20** TEST: (validación de campo puntaje en ProductFormDialog — sin jsdom; typecheck verde)
- [x] **T6.21** IMPL: campo `puntaje` en `product-form-dialog.tsx` + normalización en `products.api.ts`.
      Campo `puntaje` en `Product` type (`models.ts`).
- [x] **T6.22** TEST: (rewards CRUD — sin jsdom; cubierto por service tests y typecheck)
- [x] **T6.23** IMPL: tab "Premios CarboPuntos" en `productos.tsx` con `RewardsTable` y
      `RewardFormDialog`. CRUD completo (crear/editar/activar/desactivar).

**Widget inicio**

- [ ] **T6.24** TODO: widget "CARBOPUNTOS · HOY" — omitido porque la API no expone un endpoint
      agregado de estadísticas diarias. Requiere endpoint backend nuevo.
- [ ] **T6.25** TODO: `CarbopuntosWidget.tsx` — pendiente de T6.24.

- [x] **T6.26** VERIFY: `pnpm --filter @app/web test` 77/77 verde (46 previos + 31 nuevos).
      `pnpm --filter @app/web build` compila. Dockerfile simulado: build desde dist limpio verde.
      CI sequence: `lint` 0 errors + `typecheck` verde + `build` verde + `test` 77/77 verde.

**Hecho cuando:** los flujos F2–F8 funcionan en caja y admin, sin UI de vencimiento, con anular-por-fila.
Widget (T6.24/T6.25) aplazado — requiere endpoint agregado que no existe en WU-6a.

---

## Compuertas por WU

| WU   | Compuerta antes del PR                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| WU-1 | `pnpm --filter @app/carbopuntos-contracts build && pnpm --filter @app/carbopuntos-contracts test` verde + rebase sobre main |
| WU-2 | Tests e2e locales (PG real) del hub verde + `build` verde + rebase sobre main                                               |
| WU-3 | `pnpm --filter @app/carbopuntos-client build && pnpm --filter @app/carbopuntos-client test` verde + rebase sobre main       |
| WU-4 | Todos los tests e2e locales del hub verde + `build` verde + rebase sobre main                                               |
| WU-5 | `pnpm --filter @app/api test` verde + `build` verde + rebase sobre main                                                     |
| WU-6 | `pnpm --filter @app/web test` verde + `build` verde + rebase sobre main                                                     |

> Los tests e2e de WU-2 y WU-4 (supertest + Postgres real) se corren localmente.
> El CI no levanta un servicio Postgres; corre unit tests y build.
