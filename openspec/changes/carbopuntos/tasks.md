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

- [ ] **T2.1** TEST: crear `apps/carbopuntos/test/health.e2e-spec.ts` (supertest local, PG real)
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
- [ ] **T2.11** TEST: `apps/carbopuntos/test/migrations.e2e-spec.ts` (supertest local) —
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

- [ ] **T3.1** TEST: crear `packages/carbopuntos-client/src/__tests__/client.spec.ts` (vitest,
      mock del fetch) — verificar que el cliente: (a) incluye el header `Bearer <service_key>`,
      (b) lanza `CarbopuntosUnavailableError` si timeout/error de red, (c) valida la respuesta con Zod.
- [ ] **T3.2** IMPL: crear `packages/carbopuntos-client/package.json` (`@app/carbopuntos-client`,
      deps: `@app/carbopuntos-contracts`, `zod`).
- [ ] **T3.3** IMPL: `tsup.config.ts`, `tsconfig.json` (patrón de `packages/contracts`).
- [ ] **T3.4** IMPL: `src/errors.ts` — `CarbopuntosUnavailableError` (timeout/red) y
      `CarbopuntosApiError` (respuesta de error del hub).
- [ ] **T3.5** TEST: `src/__tests__/degradation.spec.ts` — verificar que `CarbopuntosUnavailableError`
      se lanza en timeout y que el caller puede capturarlo sin bloquear la venta.
- [ ] **T3.6** IMPL: `src/client.ts` — clase `CarbopuntosClient` con `baseUrl` y `serviceKey`.
      Timeout configurable (default 4000 ms). Validación request/response con Zod.
      Métodos: `lookupOrAffiliate`, `getBalance`, `search`, `getHistory`, `accrue`, `redeem`,
      `operation`, `reverse`, `adjust`, `voidMovement`.
- [ ] **T3.7** IMPL: `src/index.ts` (barrel).
- [ ] **T3.8** VERIFY: `pnpm --filter @app/carbopuntos-client build` compila.
      Tests pasan. Rebase sobre main.

**Hecho cuando:** el cliente compila, el fallback no bloquea la venta, y los tests pasan.

---

## WU-4 — Hub endpoints

**Rama:** `feat/carbopuntos-wu4`
**Dueño:** `apps/carbopuntos/src/`
**Dependencias:** WU-2 y WU-3 mergeados en main
**WUs desbloqueadas al mergear:** WU-5

### Tareas

- [ ] **T4.1** TEST: `apps/carbopuntos/test/auth.e2e-spec.ts` (supertest local) — verificar que
      un request sin `Authorization` devuelve 401, y con un service key válido retorna 200.
- [ ] **T4.2** IMPL: `src/auth/guards/service-key.guard.ts` — `ServiceKeyGuard`, valida
      `Authorization: Bearer <key>` contra `SedeCredential` (bcryptjs), inyecta `req.sede`.
- [ ] **T4.3** TEST: `apps/carbopuntos/test/customers.e2e-spec.ts` (supertest + PG real) —
      flujo: afiliar cliente nuevo (mock json.pe), consultar por DNI, buscar por nombre.
- [ ] **T4.4** IMPL: `src/customers/services/dni.service.ts` — `DniService`, llama
      `POST https://api.json.pe/api/dni`, valida `^[0-9]{8}$`, maneja 404/timeout.
- [ ] **T4.5** IMPL: `src/customers/customers.module.ts`, `customers.controller.ts`,
      `customers.service.ts`.
      Endpoints: `POST /customers` (afiliar: buscar local → si no, json.pe → crear),
      `GET /customers/search?q=`, `GET /customers/:dni`.
- [ ] **T4.6** TEST: `apps/carbopuntos/test/history.e2e-spec.ts` — GET `/customers/:dni/history`
      devuelve movimientos cross-sede, cada uno con su campo `sede`.
- [ ] **T4.7** IMPL: endpoint `GET /customers/:dni/history` en `customers.controller.ts`.
- [ ] **T4.8** TEST: `apps/carbopuntos/test/accrue.e2e-spec.ts` — acumular puntos, reintentar
      con misma `idempotency_key` → respuesta idempotente (mismo movimiento, no duplicado).
- [ ] **T4.9** IMPL: `src/points/points.module.ts`, `points.controller.ts`, `points.service.ts`.
      Endpoint: `POST /points/accrue` — acumulación idempotente, transacción + optimistic lock.
- [ ] **T4.10** TEST: `apps/carbopuntos/test/redeem.e2e-spec.ts` — canjear con saldo suficiente,
      rechazar con saldo insuficiente, dos sedes concurrentes (lock serializa).
- [ ] **T4.11** IMPL: endpoint `POST /points/redeem` — canje transaccional con lock, rechaza
      si saldo insuficiente.
- [ ] **T4.12** TEST: `apps/carbopuntos/test/operation.e2e-spec.ts` — operación mixta
      (acumulación + canje) atómica: si falla el canje, la acumulación no se aplica.
- [ ] **T4.13** IMPL: endpoint `POST /points/operation` — operación mixta en una sola transacción.
- [ ] **T4.14** TEST: `apps/carbopuntos/test/reverse.e2e-spec.ts` — reversa que resta puntos;
      reversa sobre venta sin acumulación previa → no-op; reversa que excede el saldo → topa en 0.
- [ ] **T4.15** IMPL: endpoint `POST /points/reverse` — reversa por `sale_ref`, no-op si no existe
      acumulación previa (C15), topa saldo en 0 (D6).
- [ ] **T4.16** TEST: `apps/carbopuntos/test/adjust.e2e-spec.ts` — ajuste manual con motivo,
      entrada en `AdminAudit`, saldo actualizado.
- [ ] **T4.17** IMPL: endpoint `POST /points/adjust` — ajuste manual admin, motivo obligatorio,
      `AdminAudit` escrito en la misma transacción.
- [ ] **T4.18** TEST: `apps/carbopuntos/test/void.e2e-spec.ts` — anular movimiento (soft-delete),
      saldo recalculado, `AdminAudit` creado, movimiento anulado no vuelve a anularse.
- [ ] **T4.19** IMPL: endpoint `POST /movements/:id/void` — soft-delete, recalcula saldo,
      escribe `AdminAudit`.
- [ ] **T4.20** VERIFY: todos los tests e2e del hub pasan localmente con PG real.
      `pnpm --filter @app/carbopuntos build` compila. Rebase sobre main.

**Hecho cuando:** todos los endpoints del hub operan con idempotencia, locking y auditoría correctos.

---

## WU-5 — Integración `apps/api`

**Rama:** `feat/carbopuntos-wu5`
**Dueño:** `apps/api/src/`
**Dependencias:** WU-3 y WU-4 mergeados en main
**WUs desbloqueadas al mergear:** WU-6

### Tareas

- [ ] **T5.1** TEST: `apps/api/src/products/products.spec.ts` — agregar casos para el campo
      `puntaje` (default 0, tipo integer, nunca negativo).
- [ ] **T5.2** IMPL: agregar columna `puntaje integer DEFAULT 0` a la entidad `Product` en
      `apps/api/src/products/entities/product.entity.ts`. Columna explícita `puntaje`.
- [ ] **T5.3** IMPL: migración `AddPuntajeToProduct` en `apps/api`.
- [ ] **T5.4** TEST: `apps/api/src/rewards/rewards.spec.ts` — CRUD de `Reward` local (crear,
      listar, activar/desactivar, eliminar lógico). Sin FK al hub.
- [ ] **T5.5** IMPL: entidad `Reward` local en `apps/api/src/rewards/entities/reward.entity.ts`
      (id, name, cost_points, is_active, created_at). Columnas explícitas snake_case.
- [ ] **T5.6** IMPL: `RewardsModule`, `RewardsController`, `RewardsService` en `apps/api`.
      Endpoints CRUD básicos (`GET /rewards`, `POST /rewards`, `PATCH /rewards/:id`,
      `DELETE /rewards/:id` lógico).
- [ ] **T5.7** IMPL: migración `CreateRewardTable` en `apps/api`.
- [ ] **T5.8** TEST: `apps/api/src/sales/sales.spec.ts` — agregar caso: venta con `customer_dni`
      calcula puntos correctamente (Σ puntaje × qty).
- [ ] **T5.9** IMPL: agregar columna `customer_dni varchar(8) NULL` a `Sale` en
      `apps/api/src/sales/entities/sale.entity.ts`. Columna explícita. Sin FK (D20).
- [ ] **T5.10** IMPL: migración `AddCustomerDniToSale` en `apps/api`.
- [ ] **T5.11** TEST: `apps/api/src/sales/carbopuntos-accrue.spec.ts` — `createSale()` con
      `customer_dni`: llama `client.accrue` con la `idempotencyKey` correcta. Si el cliente lanza
      `CarbopuntosUnavailableError`, la venta igual se cierra y se crea una entrada en
      `carbopuntos_pending_movement`.
- [ ] **T5.12** IMPL: instanciar `CarbopuntosClient` en `apps/api` desde las env vars.
      Crear `CarbopuntosModule` que provee el cliente.
- [ ] **T5.13** IMPL: cablear acumulación en `SalesService.createSale()`: si `customer_dni` y
      puntos > 0, llamar `client.accrue(...)` tras guardar la venta. Excepción → encolar pendiente.
- [ ] **T5.14** TEST: `apps/api/src/sales/carbopuntos-reverse.spec.ts` — `cancelSale()` con
      `customer_dni`: llama `client.reverse(saleRef)`. Si falla, encola pendiente.
- [ ] **T5.15** IMPL: cablear reversa en `SalesService.cancelSale()`: si la venta tiene
      `customer_dni`, llamar `client.reverse(saleRef)`. Excepción → encolar pendiente.
- [ ] **T5.16** TEST: `apps/api/src/carbopuntos/pending-queue.spec.ts` — encolar un movimiento
      fallido, reintentar, marcar como `failed` tras N intentos.
- [ ] **T5.17** IMPL: tabla `carbopuntos_pending_movement` (migración) y servicio de cola de
      pendientes `CarbopuntosPendingService`. Backoff exponencial. Estado: `pending|retrying|failed`.
      Reintento al llamar `/sales/sync` existente (hook en `SalesSyncService` o equivalente).
- [ ] **T5.18** IMPL: actualizar `@app/contracts` o los DTOs de la sede para incluir los nuevos
      campos (`puntaje` en productos, `customer_dni` en ventas) si aún no están.
- [ ] **T5.19** VERIFY: `pnpm --filter @app/api test` pasa. `pnpm --filter @app/api build` compila.
      Rebase sobre main.

**Hecho cuando:** vender con cliente acumula puntos; cancelar revierte; el hub caído no bloquea la venta.

---

## WU-6 — Frontend `apps/web`

**Rama:** `feat/carbopuntos-wu6`
**Dueño:** `apps/web/src/`
**Dependencias:** WU-5 mergeado en main

### Tareas

**Infraestructura**

- [ ] **T6.1** TEST: `apps/web/src/services/__tests__/carbopuntos.api.spec.ts` (vitest) —
      `getCustomerBalance`, `searchCustomers`, `accruePoints`, `redeemPoints`, `reversePoints`,
      `adjustPoints`, `voidMovement` hacen las llamadas correctas a `apps/api`.
- [ ] **T6.2** IMPL: `apps/web/src/services/carbopuntos.api.ts` con los métodos anteriores.
      Llama a `apps/api`, no al hub directamente.
- [ ] **T6.3** TEST: `apps/web/src/hooks/__tests__/use-customers.spec.ts` — hook retorna datos,
      invalida correctamente al mutar.
- [ ] **T6.4** IMPL: `apps/web/src/hooks/use-customers.ts` y `use-points.ts` con TanStack Query.
      Query keys en `hooks/query-keys.ts`: `['carbopuntos', 'balance', dni]`, etc.
- [ ] **T6.5** IMPL: actualizar `hooks/query-keys.ts` — agregar claves de carbopuntos.
      Las mutaciones de puntos invalidan las query keys correspondientes (no solo `invalidateFinancialQueries`).

**Caja — flujo de puntos**

- [ ] **T6.6** TEST: `apps/web/src/components/__tests__/CustomerPanel.spec.ts` — renderiza campo
      DNI, muestra saldo, bloquea canje sin hub (cuando `isHubAvailable = false`).
- [ ] **T6.7** IMPL: `apps/web/src/components/CustomerPanel.tsx` — búsqueda/afiliación por DNI,
      teléfono opcional, checkbox de consentimiento, saldo actual.
- [ ] **T6.8** TEST: puntos a ganar y saldo proyectado se calculan en tiempo real al modificar
      el carrito.
- [ ] **T6.9** IMPL: integrar `CustomerPanel` en `apps/web/src/pages/ventas.tsx`. Mostrar
      puntos a ganar + saldo proyectado. Deshabilitar canje cuando `isHubAvailable = false` (C1/C3).
- [ ] **T6.10** TEST: `apps/web/src/components/__tests__/RedeemModal.spec.ts` — muestra premios
      disponibles del catálogo de la sede, bloquea premios con costo > saldo, requiere confirmación.
- [ ] **T6.11** IMPL: `apps/web/src/components/RedeemModal.tsx` — lista de premios, cálculo
      de saldo proyectado, confirmación explícita (RF-39).
- [ ] **T6.12** TEST: `apps/web/src/components/__tests__/PointsBlock.spec.ts` — renderiza
      "Antes X · Operación Y · Ahora Z" correctamente.
- [ ] **T6.13** IMPL: `apps/web/src/components/PointsBlock.tsx` — bloque del ticket
      (Antes / Operación / Ahora). Sin leyenda de vencimiento (D21).

**Admin — clientes y movimientos**

- [ ] **T6.14** TEST: `apps/web/src/pages/__tests__/clientes.spec.ts` — listado de clientes,
      detalle, historial cross-sede (cada movimiento muestra su `sede`).
- [ ] **T6.15** IMPL: `apps/web/src/pages/clientes.tsx` — listado con búsqueda, detalle del
      cliente, historial completo cross-sede.
- [ ] **T6.16** TEST: ajuste manual — modal pide motivo, botón de submit deshabilitado sin motivo.
- [ ] **T6.17** IMPL: `AdjustModal` en la página de clientes — ajuste `+`/`−` con motivo
      obligatorio. Invalida la query de balance tras confirmar.
- [ ] **T6.18** TEST: anular movimiento por fila — muestra confirmación, envía request de void,
      actualiza la lista.
- [ ] **T6.19** IMPL: botón "Anular" por fila en el historial del cliente. Sin botón de borrado
      masivo (D22).

**Admin — config puntaje y premios en Productos**

- [ ] **T6.20** TEST: `apps/web/src/pages/__tests__/productos-puntaje.spec.ts` — campo `puntaje`
      editable, default 0, no negativo.
- [ ] **T6.21** IMPL: agregar campo `puntaje` al formulario de edición de productos en
      `apps/web/src/pages/productos.tsx` (o el componente de edición existente).
- [ ] **T6.22** TEST: CRUD de premios en la sección de Productos — crear, editar, desactivar.
- [ ] **T6.23** IMPL: sección de catálogo de premios en `apps/web/src/pages/productos.tsx`
      (o nueva sub-página/tab). Lista de premios de la sede con activar/desactivar.

**Widget inicio**

- [ ] **T6.24** TEST: `apps/web/src/components/__tests__/CarbopuntosWidget.spec.ts` — renderiza
      "puntos emitidos / canjes / clientes nuevos" correctamente con datos mockeados.
- [ ] **T6.25** IMPL: `apps/web/src/components/CarbopuntosWidget.tsx` —
      widget "CARBOPUNTOS · HOY" en la página de inicio.

- [ ] **T6.26** VERIFY: `pnpm --filter @app/web test` pasa. `pnpm --filter @app/web build` compila.
      Rebase sobre main. Suite completa verde.

**Hecho cuando:** los flujos F2–F8 funcionan en caja y admin, sin UI de vencimiento, con anular-por-fila.

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
