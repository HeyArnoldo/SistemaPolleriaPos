# Proposal — cambio `carbopuntos`

> Estado: cerrado. Todas las decisiones D1–D25 están resueltas.
> Fuente de verdad: `docs/CARBOPUNTOS-ANALISIS.md`, `-DECISIONES.md`, `-PUNTOS-Y-PREMIOS.md`,
> `-CASOS-Y-FLUJOS.md`, `-PLAN.md`. Este documento **referencia** esos archivos; no los duplica.

---

## Intención

Integrar un programa de fidelización por puntos (CARBOPUNTOS) en el POS existente, compartido
entre las tres sedes (Urubamba, Pisac, Calca) de D'Carbon del Valle, sin romper la independencia
operativa y financiera de cada sede.

Requisito de partida: cada sede corre en su propia VPS con su propia base de datos. La caja,
ventas, egresos, productos y usuarios son locales. Lo único compartido es el dominio de fidelización:
cliente (DNI), saldo de puntos e historial de movimientos.

---

## Alcance

### Incluido

| Área                             | Descripción                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/carbopuntos-contracts` | Schemas Zod del contrato compartido (hub ↔ sedes)                                                 |
| `packages/carbopuntos-client`    | Cliente HTTP tipado con degradación elegante                                                      |
| `apps/carbopuntos`               | Hub NestJS + PostgreSQL propio + migraciones                                                      |
| `apps/api` (mínimo)              | `Product.puntaje`, `Reward` local, `Sale.customer_dni`, cola de pendientes, wiring accrue/reverse |
| `apps/web`                       | UI de caja (DNI, saldo, canje) y admin (clientes, ajustes, config puntaje/premios)                |
| `.github/workflows/ci.yml`       | Paso de build de `@app/carbopuntos-contracts` antes de lint/typecheck                             |

### Excluido

- Despliegue Coolify (Fase 6 del plan) — fuera del alcance de este backlog TDD.
- Derecho al olvido / GDPR (borrado total de cliente) — postergado (ver D22).
- UI propia del hub — el hub no tiene frontend; toda la operación pasa por cada `apps/web`.
- Multi-empresa: el código es parametrizable; el deploy de un hub por empresa es operativo, no de código.

---

## Decisiones cerradas (resumen D1–D25)

Las decisiones completas están en `docs/CARBOPUNTOS-DECISIONES.md`. A continuación el resumen
ejecutivo de las que impactan el diseño:

| ID  | Decisión                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- |
| D1  | Offline = venta anónima. La acumulación se aplica retroactiva al reconectar. El canje es siempre online.        |
| D2  | Catálogo de premios local por sede, administrado desde el menú de Productos. El hub no almacena premios.        |
| D3  | Campo `puntaje` entero por producto (default 0). Puntos de la venta = Σ(puntaje × cantidad).                    |
| D4  | Premio = beneficio en puntos, no dinero. No reduce el neto de caja. El ítem va al ticket como cortesía (S/. 0). |
| D5  | Cancelar una venta con cliente dispara reversa de puntos. Fallo → cola de pendientes.                           |
| D6  | Saldo nunca negativo. Reversa que excede el saldo topa en 0 (diferencia auditada).                              |
| D7  | Sin borrado físico. "Eliminar" = anular movimiento (soft-delete) con motivo y auditoría.                        |
| D12 | API de DNI: json.pe (`POST https://api.json.pe/api/dni`, `Bearer JSONPE_API_KEY`). Solo en el hub.              |
| D14 | Cada sede se autentica con `CARBOPUNTOS_SERVICE_KEY`; el hub deriva la sede desde `SedeCredential`.             |
| D15 | Idempotencia por clave `{saleNumber, sede, tipo}`. Sin acumulaciones/canjes dobles.                             |
| D16 | Cola de pendientes por sede (patrón queue-manager), reintento al reconectar.                                    |
| D17 | Operaciones de saldo transaccionales en el hub con optimistic locking (`version`).                              |
| D21 | Los puntos NO vencen. Eliminar toda lógica de vencimiento del prototipo.                                        |
| D22 | Solo anular-por-fila (soft-delete). Sin borrado masivo del historial.                                           |
| D23 | Teléfono opcional para afiliar. No es único.                                                                    |
| D24 | Un hub por empresa (app + DB propios). Sin `company_id` en las tablas.                                          |
| D25 | Cualquier admin puede ajustar/anular puntos de cualquier cliente. El control es la auditoría total.             |

---

## Resultado esperado

Al completar el cambio `carbopuntos`:

1. El cajero puede vincular un cliente por DNI en la venta, acumular puntos automáticamente y
   canjear premios del catálogo de la sede con confirmación explícita.
2. El admin ve el historial cross-sede, puede ajustar puntos manualmente (con motivo) y anular
   movimientos por fila. El registro de auditoría es visible para todos los admins.
3. El hub central es el único dueño del saldo. Las sedes degradan elegantemente cuando el hub
   no responde: la venta de dinero nunca se bloquea.
4. Los puntos no vencen. El saldo nunca es negativo.
5. El sistema es multi-empresa: desplegar un hub por empresa no requiere cambios de código.

---

## Restricciones de implementación

- `synchronize: false` siempre (solo migraciones).
- Decimales como string en TypeORM; `z.coerce.number()` en contratos.
- Zona horaria `America/Lima` para todos los timestamps.
- Rutas literales antes de paramétricas en los controllers.
- Nunca push directo a `main`. Estrategia: stacked-to-main (WU-1 mergea primero como base).
- Toda mutación de puntos debe usar `invalidateFinancialQueries` + las query keys nuevas de carbopuntos.
- Tests son la compuerta: suite completa verde tras rebase sobre main antes de cada PR.
