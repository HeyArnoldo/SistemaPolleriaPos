# CARBOPUNTOS — Plan de implementación

> Objetivo: dejar el plan tan concreto que implementar sea **solo ejecutar**. Cada fase lista archivos,
> contratos y criterios de "hecho". Plantilla de referencia: dominio **Ventas** (`apps/api/src/sales`).
> Decisiones base: ver `CARBOPUNTOS-DECISIONES.md`. Datos: `CARBOPUNTOS-PUNTOS-Y-PREMIOS.md`.
> Supuestos vigentes (a confirmar): **D1 = A** (offline anónima + acumulación retroactiva, canje solo
> online) y **D2 = A** (catálogo de premios local por sede).

## Mapa de entregables

```
packages/
  carbopuntos-contracts/     # FASE 1
  carbopuntos-client/        # FASE 3
apps/
  carbopuntos/               # FASE 2 (hub + DB propia)
  api/                       # FASE 4 (integración por sede)
  web/                       # FASE 5 (UI — depende de mockups)
```

---

## FASE 0 — Cierre de decisiones (sin código)

- [ ] Confirmar **D1** (offline) y **D2** (catálogo local).
- [ ] Confirmar combos (puntaje = porción de pollo).
- [x] D3, D4, D7, D12 resueltas.
      **Hecho cuando:** no quedan decisiones bloqueantes.

---

## FASE 1 — Contratos compartidos `@app/carbopuntos-contracts`

Patrón idéntico a `packages/contracts` (tsup, barrel, `workspace:*`, `zod`).

Archivos:

- [ ] `packages/carbopuntos-contracts/package.json` (`@app/carbopuntos-contracts`, dep `zod`)
- [ ] `packages/carbopuntos-contracts/tsup.config.ts`, `tsconfig.json`
- [ ] `packages/carbopuntos-contracts/src/index.ts` (barrel)
- [ ] `src/customer.ts` — `customerSchema`, `affiliateCustomerSchema` (dni 8 díg., phone opcional, consentimiento), `customerSearchSchema`
- [ ] `src/dni.ts` — `dniLookupResponseSchema` (mapea json.pe: nombres, apellido_paterno/materno, nombre_completo)
- [ ] `src/movement.ts` — `pointsMovementSchema` (type: accrual|redeem|adjustment|reversal, points, balanceBefore/After, sede, userRef, saleRef, detail, idempotencyKey, voided)
- [ ] `src/balance.ts` — `balanceSchema`, `projectedBalanceSchema`
- [ ] `src/operations.ts` — `accrueSchema`, `redeemSchema`, `mixedOperationSchema`, `reverseSchema`, `adjustSchema`, `voidMovementSchema`
- [ ] `src/reward.ts` — `rewardSchema` (config local por sede: nombre, costoPuntos, activo)

Reglas:

- Montos/puntos con `z.coerce.number()` (gotcha decimal-as-string).
- `idempotencyKey` derivada de `{saleNumber, sede, type}` (D15).
  **Hecho cuando:** `pnpm --filter @app/carbopuntos-contracts build` compila y exporta todos los schemas.

---

## FASE 2 — Hub `apps/carbopuntos` (NestJS + TypeORM + PG propio)

Scaffolding como `apps/api` (ConfigModule, TypeOrmModule, ZodValidationPipe, prefijo `/api`, `/health` fuera del prefijo, `docker-entrypoint.sh` con `migration:run`).

### 2.1 Base de datos (DB propia del hub)

Entidades (`synchronize:false`, snake_case, decimales string, timestamptz):

- [ ] `Customer` — `id`, `dni` (unique), `first_name`, `last_name`, `full_name`, `phone` (null), `consent_at`, `is_active`, `created_at`
- [ ] `PointsBalance` — `customer_id` (unique), `balance` (int), `version` (optimistic lock — D17)
- [ ] `PointsMovement` (inmutable) — `id`, `customer_id`, `type`, `points`, `balance_before`, `balance_after`, `sede`, `user_ref`, `sale_ref`, `detail`, `idempotency_key` (unique), `is_voided`, `voided_by`/`voided_at`/`void_reason`, `created_at`
- [ ] `AdminAudit` — `id`, `action`, `actor_ref`, `sede`, `customer_id`, `payload`, `created_at`
- [ ] `SedeCredential` — `id`, `sede`, `service_key_hash`, `is_active` (auth servicio-a-servicio)
- [ ] Migración inicial `CreateCarbopuntosSchema` + seed de `SedeCredential` (sedes de la empresa).
  > El catálogo de premios **no** es entidad del hub (D2): vive en `apps/api` de cada sede (ver F4.1).

### 2.2 Seguridad servicio-a-servicio

- [ ] `ServiceKeyGuard` — valida `Authorization: Bearer <service_key>`, deriva `sede` desde `SedeCredential` (D14). Inyecta `sede` en el request.

### 2.3 Integración DNI (json.pe)

- [ ] `DniService` — `POST https://api.json.pe/api/dni`, `Bearer JSONPE_API_KEY`, valida `^[0-9]{8}$`, mapea respuesta, maneja 404/timeout (D13).

### 2.4 Endpoints del hub (todos bajo `ServiceKeyGuard`)

- [ ] `POST   /customers` — afiliar (busca local → si no, json.pe → crea). Requiere consentimiento.
- [ ] `GET    /customers/search?q=` — por dni/nombre/teléfono (RF-52)
- [ ] `GET    /customers/:dni` — detalle + saldo
- [ ] `GET    /customers/:dni/history` — historial **completo cross-sede** (decisión §10), cada item con su `sede`
- [ ] `POST   /points/accrue` — acumulación idempotente (RF-26/28)
- [ ] `POST   /points/redeem` — canje transaccional con lock; rechaza si saldo insuficiente (RF-34/C8/C9)
- [ ] `POST   /points/operation` — operación mixta atómica (acumulación + canje) (RF-36/F6)
- [ ] `POST   /points/reverse` — reversa por `sale_ref`; no-op si no existe acumulación previa (C5/C15)
- [ ] `POST   /points/adjust` — ajuste manual admin, motivo obligatorio, auditado (RF-47/D8)
- [ ] `POST   /movements/:id/void` — anular movimiento (soft-delete), recalcula saldo, auditado (D7)

### 2.5 Reglas transversales

- [ ] Todas las operaciones de saldo: transacción + `version` (optimistic lock), `balance_before/after` dentro de la tx.
- [ ] Idempotencia por `idempotency_key` (rechazo de duplicados → respuesta idempotente, no error).
- [ ] Saldo negativo: según **D6** (default A: permitido y auditado).
- [ ] Auditoría en `AdminAudit` para adjust/void.
      **Hecho cuando:** el hub levanta, corre migraciones, y los endpoints pasan tests de idempotencia, lock y soft-delete.

---

## FASE 3 — Cliente `@app/carbopuntos-client`

Paquete consumido por `apps/api`. Construido sobre los contratos.

- [ ] `CarbopuntosClient` — base URL `CARBOPUNTOS_HUB_URL`, header `Bearer CARBOPUNTOS_SERVICE_KEY`
- [ ] Validación request/response con Zod
- [ ] Timeout 3–5 s (D18) + **degradación**: si el hub no responde, lanzar error tipado que la sede convierte en "sin puntos" (no bloquear venta)
- [ ] Métodos: `lookupOrAffiliate`, `getBalance`, `search`, `getHistory`, `accrue`, `redeem`, `operation`, `reverse`, `adjust`, `voidMovement`
      **Hecho cuando:** la sede puede llamar al hub con tipos end-to-end y el fallback no rompe la venta.

---

## FASE 4 — Integración en la sede `apps/api`

### 4.1 Esquema local (cambios mínimos, con migración)

- [ ] `Product.puntaje` (int, default 0) — config de puntos por producto (D3)
- [ ] `Reward` (entidad **local** de sede) — `id`, `name`, `cost_points`, `is_active`. Catálogo de
      premios por sede, administrado desde el menú de Productos (D2)
- [ ] `Sale.customer_dni` (varchar null) — referencia **débil** al cliente del hub (D20)
- [ ] Migración + extender contratos `@app/contracts` (product, reward, sale) y DTOs

### 4.2 Acumulación / canje

- [ ] `createSale()`: si `customer_dni`, calcular puntos (`Σ puntaje×qty`), llamar `client.accrue/operation` con `idempotencyKey` `{saleNumber,sede,...}`. Fallo del hub → encolar pendiente (D16), venta igual se cierra.
- [ ] `cancelSale()`: si la venta tenía cliente, llamar `client.reverse(saleRef)`; fallo → encolar pendiente (C5).

### 4.3 Cola de movimientos pendientes (D16, patrón `queue-manager`)

- [ ] Tabla/cola local de movimientos de puntos pendientes + reintento al reconectar (hook de `/health`/sync existente). Backoff; tras N intentos, marcar para revisión (C14).

### 4.4 Env / config por sede

- [ ] `CARBOPUNTOS_HUB_URL`, `CARBOPUNTOS_SERVICE_KEY`, `STORE_ID` en `.env.example` y config.
      **Hecho cuando:** vender con cliente acumula puntos en el hub; cancelar revierte; offline no rompe nada.

---

## FASE 5 — Frontend `apps/web`

Plantilla: página `ventas.tsx` + sus hooks/services. Base visual: prototipo `05_CarboPuntos_UI_Prototipo.jsx`.

- [ ] `services/carbopuntos.api.ts` (axios → `apps/api`, no directo al hub)
- [ ] `hooks/use-customers.ts`, `use-points.ts`
- [ ] `CustomerPanel` en ventas: búsqueda/afiliación por DNI (F2/F3), teléfono **opcional** + consentimiento
- [ ] En ventas: puntos a ganar + **saldo proyectado** en tiempo real (RF-29/30/37); deshabilitar canje sin hub (C1/C3)
- [ ] Canje y operación mixta (F5/F6); confirmación explícita (RF-39)
- [ ] Bloque de puntos en ticket: **Antes / Operación / Ahora** (ver -PUNTOS-Y-PREMIOS §3)
- [ ] Página `clientes.tsx` (admin): listado, detalle, historial cross-sede, ajuste (motivo), **anular movimiento por fila** (soft-delete) — NO borrado masivo (D22)
- [ ] Widget "CARBOPUNTOS · HOY" en inicio (puntos emitidos / canjes / clientes nuevos)
- [ ] `query-keys.ts`: claves de puntos + invalidación tras mutaciones

Lo que el prototipo **no** cubre y hay que agregar (deja Productos como placeholder) — todo en la
**pantalla de Productos** (admin), por sede (D2):

- [ ] **Config de `puntaje` por producto**
- [ ] **CRUD del catálogo de premios** (cada premio: nombre + costo en puntos + activo)

Lo que el prototipo trae y se **descarta** (decisiones zanjadas):

- [ ] Quitar toda la UI de **vencimiento de puntos** (D21: no vencen): avisos, "vencen en X días", leyenda del ticket
- [ ] Reemplazar "Eliminar historial" (borrado masivo) por "anular movimiento" (D22)
- [ ] Saldo nunca negativo (D6): el ajuste ya lo bloquea en el prototipo — mantener

**Hecho cuando:** los flujos F2–F8 funcionan en caja y admin, alineados al prototipo (sin vencimiento).

---

## FASE 6 — Despliegue (Coolify) — un hub por empresa (D24)

- [ ] App `apps/carbopuntos` + PostgreSQL **propios por empresa** (Dockerfile `--filter @app/carbopuntos...`)
- [ ] Por empresa: `JSONPE_API_KEY` (su cuenta json.pe) + seed de `SedeCredential` con SUS sedes
- [ ] En cada sede: `CARBOPUNTOS_HUB_URL` (el hub de su empresa), `CARBOPUNTOS_SERVICE_KEY`, `STORE_ID`
- [ ] Cookie/CORS sin cambios (la sede llama al hub server-to-server, no el navegador)
- [ ] Empresa nueva = repetir este deploy (nuevo hub + DB); el código es el mismo
      **Hecho cuando:** las sedes de cada empresa operan contra el hub de su empresa, aisladas entre empresas.

---

## Orden de ejecución y dependencias

```
F0 → F1 → F2 → F3 → F4 → F5 → F6
              └─ F2 y F3 pueden solaparse una vez fijados los contratos (F1)
```

F5 puede empezar su andamiaje en paralelo, pero el detalle de UI espera los mockups.

## Pendientes para arrancar la ejecución

1. Confirmar D1 y D2 (asumidas en A).
2. Confirmar combos.
3. Recibir los mockups del prototipo (para F5).
