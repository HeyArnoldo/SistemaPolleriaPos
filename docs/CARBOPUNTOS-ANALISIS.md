# CARBOPUNTOS — Análisis de arquitectura e implementación

> Estado: análisis previo a implementación. Cierra con decisiones recomendadas y un punto de negocio pendiente.
> Fuente funcional: "Levantamiento funcional del POS con integración CARBOPUNTOS" (72 RF, 21 RNF, 15 RN, 22 casos de uso).
>
> **Documentos del módulo (leer en este orden):**
>
> 1. `CARBOPUNTOS-ANALISIS.md` (este) — arquitectura, contratos, modelo de datos, despliegue.
> 2. `CARBOPUNTOS-DECISIONES.md` — todas las decisiones, con su estado (resueltas / a confirmar).
> 3. `CARBOPUNTOS-PUNTOS-Y-PREMIOS.md` — tablas de puntos/premios e integración DNI (json.pe).
> 4. `CARBOPUNTOS-CASOS-Y-FLUJOS.md` — cada flujo operativo y cada caso borde.
> 5. `CARBOPUNTOS-PLAN.md` — plan de implementación ejecutable por fases.

## 1. Objetivo

Integrar un programa de fidelización (cliente + puntos) **compartido entre tres sedes** —
Urubamba, Pisac y Calca de D'Carbon del Valle — sobre el POS existente, **sin romper la
independencia operativa y financiera de cada sede**.

Restricción cardinal del levantamiento: cada sede corre en su propia VPS con su propia base de
datos. Caja, ventas, egresos, productos, precios, comisiones, usuarios, impresión y reportes son
**locales por sede**. Lo único compartido es el dominio CARBOPUNTOS: cliente, saldo de puntos e
historial de movimientos.

## 2. Estado del repositorio (verificado)

Monorepo pnpm 11 (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).

| Paquete                                 | Rol                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/contracts` (`@app/contracts`) | Schemas Zod, única fuente de verdad. Build con tsup, barrel `dist/index.*`. Consumido vía `workspace:*`. |
| `packages/tsconfig` (`@app/tsconfig`)   | Config TS base.                                                                                          |
| `apps/api` (`@app/api`)                 | POS backend NestJS + TypeORM + PostgreSQL, por sede.                                                     |
| `apps/web` (`@app/web`)                 | Frontend React + Vite + shadcn.                                                                          |
| `apps/desktop`                          | Electron (impresión de tickets).                                                                         |

Huecos confirmados frente al levantamiento: **no existe** entidad `Customer`, **no existe** nada de
puntos, **no existe** integración de DNI externa, y **no hay multi-sede** (cada instancia asume una
sola sede y una sola DB). El despliegue ya separa apps: cada `apps/*` se construye filtrado desde la
raíz (`docker build -f apps/api/Dockerfile .` con `--filter @app/api...`).

## 3. Decisión de arquitectura (confirmada): hub central

El saldo de puntos es dinero gastable y debe ser consistente entre las tres sedes (RNF-06). Eso
exige **un único dueño del dato**. Se adopta un **servicio CARBOPUNTOS central (hub)**: componente
desplegable propio, con **su propia base de datos**, dueño de cliente + saldo + historial + premios,
expuesto por API. Las tres instancias POS lo consultan y escriben.

Descartadas:

- **Replicación con consistencia eventual** entre las tres DBs → riesgo de **doble gasto** del mismo
  saldo en sedes distintas. Inaceptable para un saldo canjeable.
- **DB única multi-tenant** para todo → rompe la independencia financiera y "la caída de una sede no
  afecta a las otras" (RNF-04). Acopla las finanzas de las tres.

Beneficios del hub: consistencia fuerte del saldo, **degradación elegante** (si el hub no responde,
la venta sin puntos sigue operando localmente — RNF-04/05), y escalar a una 4.ª sede es solo
apuntarla al hub (RNF-19).

## 4. Dónde vive el hub — opciones evaluadas

### Opción A — Nueva app en este mismo monorepo (RECOMENDADA)

`apps/carbopuntos`: nueva app NestJS junto a `apps/api`, con **su propia base de datos**, su propio
set de migraciones y su propio Dockerfile/deploy en Coolify. Reutiliza el patrón existente.

- **Pros:** un solo repo y un solo flujo PR/CI; cambios de contrato **atómicos** (contrato + hub +
  consumidores en el mismo commit); tipado end-to-end vía `workspace:*`; "control en el mismo repo",
  que es lo pedido. El monorepo ya despliega varias apps por separado, así que esto no agrega un
  modelo nuevo.
- **Contras:** una app y una DB más que operar. Es el costo intrínseco del hub, independiente de
  dónde viva el código.

### Opción B — Repositorio separado para el hub

- **Pros:** aislamiento fuerte de ciclo de vida y propiedad.
- **Contras:** los contratos compartidos exigen **publicar un paquete versionado** (o submódulo) →
  riesgo de desincronización de versiones, fricción en cada cambio, y contradice el requisito de
  tener el control en un único repo. Descartada para esta etapa.

### Opción C — Hub como módulo dentro de `apps/api`, con una instancia designada como hub

- **Pros:** no se crea una app nueva.
- **Contras:** mezcla el dominio **local de sede** con el dominio **compartido** en un mismo
  desplegable; acopla migraciones y DB; cada sede terminaría desplegando código de hub que no debe
  ejecutar. Contradice RNF-20 (separar claramente dominio local de dominio compartido). Descartada.

**Recomendación: Opción A.**

## 5. Estrategia de contratos (el núcleo de la pregunta)

Para que los contratos queden **correctos** y reflejen el límite entre dominio local y dominio
compartido, se separa el contrato compartido en su propio paquete, en lugar de mezclarlo en
`@app/contracts` (que hoy modela el dominio local de sede).

Estructura propuesta:

```
packages/
  carbopuntos-contracts/   # @app/carbopuntos-contracts — Zod del dominio COMPARTIDO
  carbopuntos-client/      # @app/carbopuntos-client — cliente HTTP tipado sede -> hub
apps/
  carbopuntos/             # hub NestJS: DB propia, migraciones propias, deploy propio
  api/                     # POS por sede: importa carbopuntos-client para hablar con el hub
  web/
  desktop/
```

### 5.1 `@app/carbopuntos-contracts`

Único origen de verdad del **contrato de cable** entre sedes y hub (no de entidades internas).
Mismo patrón que `@app/contracts`: tsup, barrel, `workspace:*`. Contenido:

- `customer` — alta/consulta de cliente (DNI, nombre desde API, teléfono opcional no único).
- `dni-lookup` — request/response de la API externa de DNI.
- `points-movement` — movimiento inmutable (tipo, puntos, sede, usuario, timestamp, detalle, ref. venta).
- `balance` — saldo y saldo proyectado.
- `accrual` / `redeem` — acumulación y canje (simple, solo canje, mixto).
- `reward` — premio canjeable y costo en puntos.
- `adjustment` — ajuste manual de admin (auditado).

Lo consumen **el hub** (valida entrada, tipa salida) y **cada `apps/api`** (construye el cliente y
valida respuestas). `apps/web` deriva sus tipos de aquí.

### 5.2 `@app/carbopuntos-client`

Cliente HTTP tipado que cada sede usa para hablar con el hub, construido sobre los contratos. Aquí
viven una sola vez: validación de request/response con Zod, **autenticación servicio-a-servicio**,
timeouts y la **degradación elegante** (cuando el hub no responde, la operación sin puntos no se
bloquea). Ninguna sede reimplementa la integración.

Esta separación cumple RNF-20 (límite explícito local vs compartido) y RNF-19 (sumar sedes sin tocar
el contrato), y mantiene los cambios de contrato atómicos dentro del repo.

## 6. Modelo de datos del hub (borrador)

Base de datos **propia** del hub (no es la DB de ninguna sede). `synchronize: false`, migraciones
explícitas, decimales tratados como string (gotcha del repo), timestamps en `America/Lima`.

- **Customer**: `id`, `dni` (único), `first_name`, `last_name` (tal como llega de la API, sin edición
  manual — RN-05), `phone` (opcional, no único — RN-06), `is_active`, `created_at`.
- **PointsBalance**: saldo agregado por cliente (derivable del historial, pero materializado para
  lectura rápida en caja — RNF-01). Los puntos **no vencen** (RN-07).
- **PointsMovement** (inmutable): `id`, `customer_id`, `type` (acumulación | canje | ajuste), `points`,
  `balance_before`, `balance_after`, `sede` (origen), `user_ref` (usuario de la sede), `created_at`,
  `detail`, `sale_ref` (referencia a la venta en la sede). RF-40..RF-45, RN-11.
- **AdminAudit**: registro inmutable de acciones administrativas sobre puntos (RF-49, RNF-17, D25).
  Campos: `id`, `action` (adjust | void), `actor_ref` (admin), `sede`, `customer_id`,
  `movement_id` (si aplica), `balance_before`, `balance_after`, `reason` (obligatorio), `created_at`.
  Visible para todos los admins.

> El **catálogo de premios NO vive en el hub** (D2): es **local** en `apps/api` de cada sede, se
> administra desde el menú de Productos. En el canje, la sede envía al hub `{costo_puntos,
descripcion_premio}` y el hub solo registra el `PointsMovement` de débito.

> Nota: el `sale_ref`/`user_ref` son **referencias débiles** a datos que viven en la DB de cada sede;
> el hub no tiene FK hacia las sedes (están en DBs distintas). La trazabilidad se reconstruye por esas
> referencias (RNF-18).

## 7. Límite del dominio: qué es local y qué es del hub

| Local por sede (`apps/api`)                         | Compartido (hub)                        |
| --------------------------------------------------- | --------------------------------------- |
| Ventas, items, pagos, comisiones                    | Cliente (DNI, nombre, teléfono)         |
| Caja, egresos, reportes, BI                         | Saldo de puntos                         |
| Productos, precios, categorías                      | Historial de movimientos de puntos      |
| Métodos de pago, impresión, **catálogo de premios** | Movimientos de canje (débito de puntos) |
| Usuarios, roles, auth de sede                       | Auditoría de acciones sobre puntos      |

La venta sigue siendo **local**. Cuando hay cliente vinculado, la sede registra la venta en su DB y
**adicionalmente** llama al hub para registrar el movimiento de puntos. Una venta sin cliente es una
venta normal de la sede y no toca el hub (RN-12).

## 8. Integración sede ↔ hub

- **Autenticación servicio-a-servicio:** cada sede se autentica ante el hub con una credencial de
  servicio (API key / secreto compartido por sede). El hub identifica de qué sede viene cada
  movimiento (para `sede` en el historial). No reutiliza el JWT de usuario del POS.
- **Validación de DNI externa:** la consulta a la API de DNI (RENIEC/SUNAT/proveedor) se centraliza en
  el hub, no en cada sede. Si la API no responde, el hub devuelve un error claro y la venta sin puntos
  no se bloquea (RNF-05).
- **Degradación:** toda llamada de puntos pasa por `@app/carbopuntos-client` con timeout y fallback;
  la caída del hub nunca compromete la operación financiera local (RNF-04).
- **Consistencia:** las operaciones de saldo (acumular/canjear/ajustar) son **transaccionales en el
  hub**, con confirmación explícita del canje antes del descuento (RF-39, RN-14). El cálculo de
  `balance_before/after` ocurre dentro de la transacción para evitar doble gasto.

## 8.bis Restricción offline-first (CRÍTICA, verificada en código)

El POS es offline-first de verdad, y eso condiciona todo el módulo de puntos:

- El `saleNumber` se **genera en el cliente** (Lima-time, secuencial en `localStorage`) —
  `apps/web/src/lib/ventas.ts`, usado en `apps/web/src/pages/ventas.tsx`.
- Las ventas offline se **encolan en IndexedDB** (Dexie) — `apps/web/src/lib/db.ts`,
  `apps/web/src/lib/queue-manager.ts` — y se **sincronizan en lote** al reconectar (`POST /sales/sync`,
  `apps/api/src/sales/services/sales.service.ts`), con **idempotencia por `saleNumber`** (el servidor
  responde `{success, skipped, failed}`).
- El desktop (Electron) es **fat client**: sirve la web empaquetada vía `app://` y opera sin internet;
  solo el API URL se configura por sede.
- `cancelSale()` hoy **solo marca** `is_canceled`; **no revierte** items, pagos ni puntos.

Consecuencias para CARBOPUNTOS:

- **El dinero nunca depende del hub:** la venta (con o sin internet) siempre se cierra localmente.
- **Los puntos nunca se gastan sin el hub:** consultar saldo y canjear **requieren conexión** (gastar
  contra un saldo cacheado abre la puerta al doble gasto). El canje se deshabilita sin hub.
- **La acumulación sí puede diferirse:** offline, la venta puede guardar el `customer_dni` y la
  acumulación se hace **retroactiva** al sincronizar (sujeto a la decisión D1).
- **Toda operación de puntos necesita su propia cola de reintentos** (análoga a la de ventas), porque
  el hub puede estar caído aun estando online (decisión D16), y debe ser **idempotente** (D15).
- **La cancelación debe propagar una reversa de puntos** al hub (decisión D5), con guardas para el
  caso de venta creada y cancelada ambas offline (caso C15).

El detalle de cada flujo y caso borde está en `CARBOPUNTOS-CASOS-Y-FLUJOS.md`; las decisiones abiertas
en `CARBOPUNTOS-DECISIONES.md`.

## 9. Migraciones y despliegue (Coolify)

- **Hub:** nueva app Coolify + nuevo PostgreSQL (central). Dockerfile propio siguiendo el patrón
  existente (`--filter @app/carbopuntos...` desde la raíz del repo). Entrypoint corre
  `migration:run` antes de arrancar, igual que `apps/api`.
- **Cada sede (`apps/api`):** se le agregan variables de entorno nuevas:
  `CARBOPUNTOS_HUB_URL` y `CARBOPUNTOS_SERVICE_KEY` (credencial de servicio de esa sede).
- **Sin cambios** en la DB de las sedes salvo, si se decide, una columna `customer_dni` opcional en
  `Sale` para enlazar la venta local con el cliente del hub (referencia débil, no FK).

## 10. Punto de negocio (RESUELTO)

El levantamiento (§1.4 y §9) dejaba abierta la visibilidad del historial para el administrador.
**Decisión confirmada por negocio:** el administrador de cualquier sede ve **el historial completo
del cliente en las tres sedes** (no solo el de su propia sede). El saldo ya era global.

Impacto en el diseño:

- El endpoint de historial del hub devuelve **todos** los movimientos del cliente, sin filtrar por la
  sede del administrador solicitante.
- Cada movimiento debe seguir exponiendo su `sede` de origen para que la UI distinga dónde ocurrió
  cada acumulación/canje/ajuste.
- La auditoría de acciones administrativas (RF-49) se mantiene; ver el historial global es de solo
  lectura, mientras que ajustar/eliminar movimientos sigue restringido al admin autorizado.

## 11. Riesgos y próximos pasos

Riesgos:

- Operar una app y una DB adicionales (el hub) — costo operativo asumido.
- Latencia de la llamada sede→hub en caja: mitigar con saldo materializado y timeouts cortos (RNF-01).
- Idempotencia de los movimientos de puntos ante reintentos de red: cada movimiento debe llevar una
  clave idempotente desde la sede para no acumular/canjear doble.

Próximos pasos sugeridos:

1. ~~Cerrar el punto de negocio de la §10 (visibilidad de admin).~~ Resuelto: historial completo cross-sede.
2. Definir contratos en `@app/carbopuntos-contracts` (cliente, movimiento, saldo, premio, ajuste, DNI).
3. Decidir dónde vive el catálogo de premios (local por sede vs hub).
4. Diseñar el esquema del hub y su primera migración.
5. Implementar el hub (`apps/carbopuntos`) y el cliente (`@app/carbopuntos-client`).
6. Cablear el flujo de cliente/puntos en `apps/api` + `apps/web`, usando el dominio de Ventas como
   plantilla.

> Mockups: recibido el prototipo `05_CarboPuntos_UI_Prototipo.jsx`. Calza con los flujos F1–F8. Ver
> contradicciones zanjadas en `CARBOPUNTOS-DECISIONES.md` §D (no vencen, solo soft-delete, no negativo,
> teléfono opcional).

## 12. Multi-empresa: un hub por empresa (D24)

El sistema se ofrecerá a varias empresas de pollería. Cada empresa agrupa **sus** sedes bajo **su**
hub; los puntos se comparten entre las sedes de una misma empresa y **nunca** entre empresas.

**Modelo elegido (recomendado): un hub por empresa.**

- Cada empresa despliega su propio hub (app + PostgreSQL **propios**). Aislamiento **físico** de los
  datos de clientes/puntos entre empresas.
- El **límite de empresa ES el hub**: no se agrega `company_id` a las tablas. El esquema del hub es el
  mismo para todas; lo que cambia es el deploy.
- El hub se vuelve un **deployable parametrizable** por variables: `DB_*`, `JSONPE_API_KEY`
  (por empresa), y el seed de `SedeCredential` (las sedes de esa empresa).
- El `sede` es único **dentro de su hub**, no global.
- Escalar a una empresa nueva = desplegar otro hub + su DB; sus sedes apuntan ahí con su
  `CARBOPUNTOS_HUB_URL` + `CARBOPUNTOS_SERVICE_KEY`.

**Descartado:** hub multi-tenant único con `company_id` en todas las tablas — un solo deploy pero mayor
riesgo de fuga entre empresas y radio de impacto compartido. No encaja con el ADN de independencia.

**Impacto en el código:** prácticamente nulo. Contratos, cliente, entidades y endpoints son idénticos;
solo cambia que el hub se despliega N veces (una por empresa). Si en el futuro se quiere administrar
todas las empresas desde un solo lugar, eso sería un "plano de control" aparte, fuera de este alcance.
