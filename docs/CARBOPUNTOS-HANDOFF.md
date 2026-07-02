# CARBOPUNTOS — Handoff para continuar en otra sesión

> Estado al cierre de esta sesión. El módulo CARBOPUNTOS está **completo y mergeado** salvo 3 tareas
> pendientes. Este doc + los topic_keys de engram `sdd/carbopuntos/*` y `sistemapolleriapos/*` permiten
> retomar sin perder contexto ni el flujo de trabajo.

## 1. Estado actual

- Repo: `SistemaPolleriaPos` (monorepo pnpm: `apps/{api,web,desktop,carbopuntos}`, `packages/{contracts,carbopuntos-contracts,carbopuntos-client,tsconfig}`).
- `main` @ `a4672fb` (WU-6b). Todo CARBOPUNTOS WU-1→WU-6b mergeado (PRs #46–#56).
- **Desplegado en Coolify y verde:** hub, api, web (dominios aplanados: `polleria-{sede}-{empresa}.groowtech.com`, `api-polleria-{sede}-{empresa}.groowtech.com`, `hub-...`; wildcard `*.groowtech.com` de 1 nivel cubre todo).
- Tests en main: contracts 64, carbopuntos-client 19, hub 50, api 105, web 90.

### PR abierto (preservado, NO mergeado)

- **PR #57** `feat/carbopuntos-list-customers`: listar clientes al entrar sin escribir (slice hub→api→web). Verificado verde (contracts 74, hub 53, client 23, api 107, web 96). **Pendiente: revisión adversarial (jd-judge) + OK del usuario antes de merge.**

## 2. Tareas pendientes (en orden sugerido)

### T1 — Cerrar PR #57 (list-on-load)

Revisión adversarial fresca (jd-judge-a) del diff `main..feat/carbopuntos-list-customers`; si limpio → merge squash + borrar rama + sync main.

### T2 — Pixel-perfect de la vista Clientes

Clonar el diseño del prototipo `/home/ubuntu/.claude/uploads/d2264b0d-6570-4a36-b1eb-e06a03d994e0/2db14804-05_CarboPuntos_UI_Prototipo.jsx` (idéntico a los anteriores) **pixel a pixel** en `apps/web/src/pages/clientes.tsx` (lista + detalle): tarjeta de saldo oscura, tabla, espaciados, tipografías, botones.

- **EXCEPCIONES (decisiones ya tomadas):** SIN "Próximo vencimiento" (D21: los puntos no vencen); el borrado NO es masivo → es **anular movimiento por fila** (D7/D22). El botón "Eliminar historial" del prototipo NO se replica como borrado masivo.
- **DECISIÓN DE PRODUCTO ABIERTA:** confirmar con el usuario si quiere igual el botón "Eliminar historial" (visual) o solo anular por fila. (Recomendado: solo anular por fila.)
- Hacerlo sobre la rama de #57 o una nueva; mismo flujo (TDD donde aplique, revisión, PR).

### T3 — Regla "canje recién desde la 2da compra"

Cliente recién registrado NO puede canjear en su primera compra; sí desde la segunda.

- **Hub (autoritativo):** en `apps/carbopuntos/src/points/services/points.service.ts`, en `redeem` y `operation`, antes de descontar, rechazar si el cliente tiene 0 acumulaciones previas (la acumulación de ESTA operación no cuenta como "previa", así cubre la mixta en primera compra). Error de negocio claro (4xx). Test.
- **Detalle del cliente:** exponer flag `puedeCanjear`/`tieneCompraPrevia` (hub lo calcula) para que la UI lo refleje.
- **Web:** deshabilitar canje + mensaje "Podrá canjear desde su segunda compra" cuando es primera compra (defensa en profundidad: el hub igual rechaza).
- **DECISIÓN DE PRODUCTO ABIERTA:** ¿qué cuenta como "compra"? Recomendado: "tener ≥1 compra previa que generó puntos (acumulación)". Alternativa: cualquier venta previa vinculada. Confirmar.
- Sin migración (se deduce de los movimientos). Cambio acotado.

### Follow-ups (no bloqueantes)

1. **Hub `/points/reverse` debe revertir también CANJES** (hoy solo revierte acumulaciones). Importa para la compensación del raro caso "la persistencia local de la venta falla tras debitar un canje solo-canje". Código del hub.
2. **Paso `docker build` (smoke) en `.github/workflows/ci.yml`** para cazar drift entre `package.json`/Dockerfiles y workspace-deps (habría cazado los 4 bugs de deploy de esta sesión).
3. **Widget "CARBOPUNTOS · HOY"** del inicio: requiere un endpoint de agregados del día (puntos emitidos/canjes/clientes nuevos); omitido en WU-6b.

## 3. Convenciones de trabajo (MANTENER — esto es lo que pidió el usuario)

- **Orquestador:** mantené un hilo fino; delegá el trabajo real a sub-agentes. Cada llamada Agent lleva `model` (sdd-apply→sonnet; revisiones jd-judge-a/b y fixes jd-fix-agent→opus).
- **Worktrees + paralelo:** cada unidad de trabajo en su `git worktree` propio (`/home/ubuntu/claude/carbopuntos-<algo>`), rama `feat/...` o `fix/...` desde `main` actualizado. Permite agentes simultáneos sin pisarse (propiedad por directorio).
- **TDD estricto:** RED → GREEN → REFACTOR. Runners: jest (`apps/api`, `apps/carbopuntos`), vitest (`apps/web`, `packages/*`). Los e2e del hub usan Postgres real y van en `test:e2e` (LOCAL, NO en CI).
- **Revisión adversarial (judgment-day) ANTES de cada PR:** delegá a `jd-judge-a` (y `jd-judge-b` en doble para lo crítico). Si hay hallazgos → `jd-fix-agent` con TDD → re-verificar → re-revisar. En esta sesión la revisión cazó bugs reales en CASI TODAS las WU; no la saltees.
- **Verificación del orquestador (NO confiar en el reporte del sub-agente):** después de cada agente, verificá vos contra el repo real: `git log` (commits), alcance (`git diff --name-only main..HEAD`), sin atribución IA, y corré la **secuencia CI desde dist limpio**:
  `find packages -maxdepth 2 -name dist -type d -exec rm -rf {} +` y luego build de `@app/contracts` + `@app/carbopuntos-contracts` + `@app/carbopuntos-client`, después `pnpm lint && pnpm typecheck && pnpm build && pnpm test`. Para cambios que afectan deploy, **simulá el Dockerfile** correspondiente.
- **Commits:** conventional en minúscula (commitlint). **NUNCA** agregar "Co-Authored-By" ni atribución de IA.
- **Idioma:** TUTEO siempre (jamás voseo), en respuestas y artefactos. Código/identificadores en inglés-neutro; comentarios en tuteo.
- **Git:** nunca push directo a `main`. Rama → PR → CI verde → merge squash. El merge lo autoriza el usuario (en esta sesión delegó varios con "hazlo tú"/"mergea tú").
- **Engram:** guardá decisiones/discoveries proactivamente con `project: "sistemapos-backend-nest"`. Topic keys del módulo: `sdd/carbopuntos/{proposal,design,tasks,state}`, `sistemapolleriapos/carbopuntos-*`, y los gotchas `sistemapolleriapos/gotcha-*`.

## 4. Gotchas de deploy (aprendidos a la mala esta sesión)

1. **Dockerfiles filtrados:** cuando una app gana una dep `@app/*`, hay que actualizar SU Dockerfile (COPY del package.json + del código + orden de build + COPY del dist en runtime). El CI NO lo caza (compila todo el monorepo, no el build filtrado). Ver `apps/api/Dockerfile` y `apps/web/Dockerfile` (ya arreglados).
2. **Toda app NestJS necesita `tsconfig.build.json`** que excluya `test` (si no, `nest build` emite en `dist/src/...` y rompe entrypoint/Dockerfile). Ver `apps/carbopuntos/tsconfig.build.json`.
3. **Rutas relativas en scripts** (seed, etc.): verificá que el dist resuelva (`dist/config/...` vs `dist/src/config/...`).
4. El CI no ejecuta migraciones/entrypoint; los fallos de deploy solo se ven al levantar el contenedor en Coolify.

## 5. Arquitectura y reglas de negocio (resumen)

- **Hub central por empresa** (`apps/carbopuntos`, DB propia): dueño único de cliente + saldo + historial. Las sedes (`apps/api`) le pegan por HTTP vía `@app/carbopuntos-client` con auth de servicio (`CARBOPUNTOS_SERVICE_KEY` ↔ `SEDE_KEY_*` del hub). La web habla con la API, NUNCA con el hub.
- **Reglas:** puntos NO vencen (D21); saldo nunca negativo, topar en 0 (D6); soft-delete de movimientos, no borrado físico (D7/D22); premio = beneficio en puntos, NO toca caja en soles (D4); puntaje fijo por producto (D3); historial admin cross-sede (D25); el **canje exige hub ONLINE** (no offline, no encolar — D1/C1/C3); la **acumulación** sí degrada/encola si el hub está caído; idempotencia por `{STORE_ID, saleNumber, tipo}` (D15).
- **DNI:** json.pe (`POST https://api.json.pe/api/dni`, Bearer `JSONPE_API_KEY`, solo en el hub).
- Docs del módulo: `docs/CARBOPUNTOS-{ANALISIS,DECISIONES,PUNTOS-Y-PREMIOS,CASOS-Y-FLUJOS,PLAN}.md`.

## 6. Env por servicio (Coolify) — marcar secretos como Runtime-only

- **web** `polleria-{sede}-...`: `VITE_API_URL=https://api-polleria-{sede}-...` (build-time).
- **api** `api-polleria-{sede}-...`: `CARBOPUNTOS_HUB_URL=https://<hub>/api` (¡con `/api`!), `CARBOPUNTOS_SERVICE_KEY=<clave de la sede>`, `STORE_ID=<sede>`, `CORS_ORIGIN`/`FRONTEND_URL=https://polleria-{sede}-...`, + DB\_\*/JWT.
- **hub** `hub-...`: DB\_\* propios, `HUB_PORT=3100`, `JSONPE_API_KEY`, `SEDE_KEY_URUBAMBA|PISAC|CALCA` (reales; deben coincidir con la SERVICE_KEY de cada sede), `BCRYPT_ROUNDS`.
