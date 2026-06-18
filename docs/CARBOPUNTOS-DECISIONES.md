# CARBOPUNTOS — Decisiones a tomar

> Propósito: reunir **todas** las decisiones abiertas antes de escribir código. Cada una trae
> opciones, recomendación y el impacto. Completa el campo **Tu decisión** y con eso cerramos el diseño.
> Acompaña a `CARBOPUNTOS-ANALISIS.md` (arquitectura) y `CARBOPUNTOS-CASOS-Y-FLUJOS.md` (flujos/casos).

Leyenda de estado: 🟢 recomendación clara · 🟡 necesita tu criterio de negocio · 🔴 hay un conflicto en el levantamiento que hay que resolver.

---

## A. Negocio / producto

### D1 — Comportamiento offline de los puntos ✅ RESUELTO: opción A

El POS opera sin internet; el hub de puntos es remoto. ¿Qué pasa con los puntos cuando no hay conexión?

- **Opción A (recomendada):** offline la venta es **anónima** (sin cliente, sin puntos). Si el cajero igual captura el DNI, la **acumulación** se hace **retroactiva** al sincronizar. El **canje NUNCA es offline**.
- **Opción B:** bloquear toda venta a cliente cuando no hay hub (peor UX en caja).
- **Opción C:** permitir canje offline contra un saldo cacheado (❌ riesgo de doble gasto — desaconsejado).

**Por qué A:** el saldo es dinero gastable; canjear sin ver el saldo real del hub permite gastar dos veces. Acumular sí se puede diferir sin riesgo.
**Decisión:** A — confirmada. Offline la venta es anónima; la acumulación se aplica retroactiva al
reconectar; **el canje es siempre online**.

### D2 — Dónde vive el catálogo de premios ✅ RESUELTO: local por sede, en el menú de Productos

RF-60: "cada sede define premios canjeables y su costo en puntos". Pero el saldo es global.

- **Opción A (recomendada):** el **catálogo de premios es local por sede** (cada sede define qué premios ofrece y su costo). El **canje (débito de puntos) se registra en el hub** contra el saldo global. El hub guarda el detalle del premio canjeado como texto + costo, no el catálogo.
- **Opción B:** catálogo de premios **centralizado en el hub**, igual para las tres sedes.

**Decisión:** A — cada sede define **sus** premios, administrados **desde el menú de Productos** (junto al
`puntaje` por producto). El catálogo es **local** en `apps/api` de cada sede; el hub solo recibe en el
canje `{costo_puntos, descripcion_premio}` y registra el débito contra el saldo global.

### D3 — Cómo se calcula el puntaje ganado ✅ RESUELTO: puntos fijos por producto

**Decisión:** A — campo `puntaje` entero por producto (config por sede, default 0). Puntos de la venta
= `Σ (puntaje × cantidad)`. Valores de arranque y tema combos en `CARBOPUNTOS-PUNTOS-Y-PREMIOS.md`.
Pendiente menor (combos): confirmar que cada combo lleva el puntaje de su porción de pollo (recomendado).

### D4 — Qué es un "premio" respecto al dinero ✅ CONFIRMADO POR DATOS: opción A

Los ejemplos del prototipo (premios = productos gratis; ticket con bloque de puntos Antes/Operación/Ahora;
caja en soles solo con lo pagado) confirman la opción A.

- **Opción A (elegida):** el premio es un **beneficio canjeado con puntos**, NO dinero. No reduce el neto
  de caja en soles; el ítem gratis va al ticket como cortesía (S/. 0) y no genera puntos. Los puntos se
  reportan aparte.
- **Opción B (descartada):** descuento en soles sobre el total.

**Impacto:** la caja/BI actuales **no se tocan**. Detalle en `CARBOPUNTOS-PUNTOS-Y-PREMIOS.md` §3.
(Confirma solo si tu intención era distinta.)

### D5 — Reversa de puntos al cancelar una venta 🟡

Hoy `cancelSale()` solo marca `is_canceled`; no revierte nada.

- **Opción A (recomendada):** al cancelar una venta que acumuló puntos, el hub registra un **movimiento de reversa** (resta los puntos acumulados). Si la venta tenía un canje, **devuelve** los puntos canjeados.
- **Opción B:** no revertir (los puntos quedan; simple pero incorrecto).

**Por qué A:** sin reversa, una venta anulada deja puntos "regalados".
**Impacto:** define un hook post-cancel que llama al hub. Ver caso C5/C6 en CASOS-Y-FLUJOS.
**Tu decisión:** \_\_\_

### D6 — Saldo negativo por reversa o ajuste ✅ RESUELTO: nunca negativo, topar en 0

**Decisión:** el saldo **nunca** puede ser negativo. Un ajuste que dejaría negativo se bloquea
(como en el prototipo). Una reversa por cancelación que excedería el saldo **topa el saldo en 0** y
registra la diferencia no recuperada (queda auditada, sin dejar saldo negativo).

- ~~A: permitir negativo~~ (descartada) · ~~B: bloquear reversa~~ · **C (elegida): topar en 0.**

### D7 — Qué significa "eliminar historial de puntos" ✅ RESUELTO: soft-delete

RF-48 pide "eliminar historial", pero RF-40/RNF-16-18 exigen historial **inmutable y auditable**. Son contradictorios.

- **Opción A (elegida):** **no hay borrado físico**. "Eliminar" = **anular un movimiento** (soft-delete) con motivo y autor, recalculando el saldo y dejando rastro de la anulación.
- **Opción B:** borrado físico real (rompe la trazabilidad; desaconsejado).

**Decisión:** A — soft-delete. El historial nunca se borra físicamente; un movimiento "eliminado" se
marca como anulado (con autor, sede, fecha y motivo) y el saldo se recalcula. La anulación misma queda
auditada (RF-49).

### D8 — Ajuste manual de puntos 🟢

RF-47: ajustes manuales por admin.

- **Recomendación:** solo **admin autorizado**, **motivo obligatorio**, queda auditado (autor, sede, fecha, valor anterior/posterior). Sin tope, pero todo registrado.
  **Tu decisión:** \_\_\_

### D9 — Cliente sin DNI 🟢

- **Recomendación:** el cliente del programa **siempre tiene DNI** (es su identificador natural y único — RF-19/RF-24). Una venta sin DNI es venta normal anónima (RN-12). No se afilia sin DNI.
  **Tu decisión:** \_\_\_

### D10 — Consentimiento de afiliación 🟢

RF-25: autorización del cliente antes de afiliar.

- **Recomendación:** confirmación explícita en caja (checkbox/registro), guardando **fecha/hora de consentimiento** en el `Customer`.
  **Tu decisión:** \_\_\_

### D11 — Datos iniciales / migración 🟢

- **Recomendación:** arranque **desde cero** (no hay clientes ni puntos previos que migrar). Si existieran, se define un import aparte.
  **Tu decisión:** \_\_\_

---

## B. Integraciones externas

### D12 — Proveedor de la API de DNI ✅ RESUELTO: json.pe

**Decisión:** **json.pe** — `POST https://api.json.pe/api/dni`, auth `Bearer <APIKEY>`, body `{dni}`.
La apikey la tiene el negocio y vive **solo en el hub** (`JSONPE_API_KEY`). El nombre se cachea de forma
permanente en `Customer`; solo se consulta la primera vez que se afilia un DNI. Contrato completo en
`CARBOPUNTOS-PUNTOS-Y-PREMIOS.md` §4.

### D13 — Comportamiento si la API de DNI no responde 🟢

- **Recomendación:** no bloquear la venta sin puntos (RNF-05). Para **afiliar un DNI nuevo** se necesita la API; si está caída, se informa y se reintenta luego. Un cliente **ya afiliado** no necesita la API (su nombre ya está en el hub).
  **Tu decisión:** \_\_\_

---

## C. Técnicas / arquitectura

### D14 — Identidad de la sede ante el hub 🟢

Hoy no existe noción de "sede" en el código (cada instancia = una sede).

- **Recomendación:** cada `apps/api` recibe `CARBOPUNTOS_HUB_URL`, `CARBOPUNTOS_SERVICE_KEY` y un `STORE_ID`. El hub valida la clave y deriva la sede; cada movimiento guarda esa `sede`.
  **Tu decisión:** \_\_\_

### D15 — Idempotencia de los movimientos de puntos 🟢

El sync de ventas ya es idempotente por `saleNumber`.

- **Recomendación:** cada movimiento de puntos lleva una **clave idempotente** derivada de `{saleNumber, sede, tipo}`. Reintentar nunca acumula/canjea doble. El hub rechaza duplicados.
  **Tu decisión:** \_\_\_

### D16 — Reconciliación de movimientos diferidos 🟡

Acumulaciones retroactivas (D1) y reversas (D5) pueden quedar pendientes si el hub no responde.

- **Opción A (recomendada):** cada sede mantiene una **cola de movimientos de puntos pendientes** (análoga a la cola de ventas offline) y reintenta al reconectar.
- **Opción B:** el hub expone un endpoint de reconciliación y la sede reenvía periódicamente.

**Impacto:** define dónde vive la cola de reintentos. A reutiliza el patrón existente de `queue-manager`.
**Tu decisión:** \_\_\_

### D17 — Concurrencia sobre el saldo 🟢

Dos sedes podrían canjear el mismo saldo a la vez.

- **Recomendación:** las operaciones de saldo son **transaccionales en el hub** con **bloqueo/optimistic locking** (columna de versión). `balance_before/after` se calculan dentro de la transacción.
  **Tu decisión:** \_\_\_

### D18 — Timeout de las llamadas al hub desde caja 🟢

- **Recomendación:** timeout corto (**3–5 s**) con saldo materializado para lectura rápida (RNF-01). Si excede, degradar (no bloquear la venta).
  **Tu decisión:** \_\_\_

### D19 — UI del hub 🟢

- **Recomendación:** el hub **no tiene UI propia**; toda la operación (caja y admin) ocurre desde el POS de cada sede consumiendo la API del hub.
  **Tu decisión:** \_\_\_

### D20 — Enlace venta↔cliente en la DB de sede 🟢

- **Recomendación:** agregar columna **débil** `customer_dni` (opcional) en `Sale`. No es FK (el cliente vive en otra DB, la del hub). Sirve para trazar localmente qué venta fue de qué cliente.
  **Tu decisión:** \_\_\_

---

## D. Aclaraciones tras revisar el prototipo (contradicciones zanjadas)

### D21 — ¿Los puntos vencen? ✅ RESUELTO: NO vencen

El prototipo los hacía vencer al año; el levantamiento (RN-07/RF-32) dice que **no vencen**. Manda el
levantamiento: **los puntos NO vencen.** Se elimina toda la lógica de vencimiento del prototipo
(fecha de expiración por acumulación, avisos "X pts vencen en Y días", leyenda del ticket, consumo FIFO).
El saldo es un entero simple, sin fecha de caducidad.

### D22 — Alcance de "eliminar historial" ✅ RESUELTO: solo soft-delete operativo

Solo existe la **anulación de un movimiento** (soft-delete, auditado — D7). **No** se implementa el
borrado total del cliente / derecho al olvido (Ley 29733) que mostraba el prototipo. En consecuencia,
en el panel admin la acción "Eliminar historial" (borrado masivo) se **reemplaza** por "anular
movimiento" por fila. (Si más adelante se necesita derecho al olvido, será una función separada.)

### D23 — Teléfono ✅ RESUELTO: opcional

El teléfono es **opcional** para afiliar (RF-22). Se relaja la exigencia del prototipo. No es único (RN-06).

### D24 — Multi-empresa / múltiples hubs ✅ RESUELTO: un hub por empresa

El sistema se venderá a varias empresas de pollería; cada empresa agrupa SUS sedes en SU hub.

- **Opción A (recomendada):** **un hub por empresa** — app + DB propios por empresa, aislamiento físico.
  El "límite de empresa" ES el hub; no se agrega `company_id` a las tablas. `JSONPE_API_KEY` por empresa.
- **Opción B:** un hub multi-tenant con `company_id` en todas las tablas (mayor riesgo de fuga, un solo deploy).

**Decisión:** A — un hub por empresa (app + DB propios, sin `company_id`, `JSONPE_API_KEY` por empresa).
Detalle en `CARBOPUNTOS-ANALISIS.md` §12.

### D25 — Gobierno de la modificación de puntos ✅ RESUELTO: modelo de auditoría

El saldo es **único y global** por cliente (no hay puntos por sede). Cada sede tiene su **Administrador**.

- **Decisión:** **cualquier admin de cualquier sede puede ver y modificar (ajustar/anular) los puntos
  de cualquier cliente**, incluso los ganados en otra sede. No hay admin global; el cajero no puede
  modificar puntos (RF-70).
- **El control no es restringir quién toca, sino la auditoría total.** Cada modificación registra:
  `actor` (usuario admin), `sede`, `fecha/hora`, `saldo_anterior`, `saldo_posterior`, `motivo`
  (obligatorio), y tipo (ajuste manual | anulación de movimiento).
- Ese rastro es **visible para todos los admins** (transparencia entre sedes).
- Reglas: nunca deja saldo negativo (D6); operación transaccional con bloqueo en el hub (D17); el
  movimiento de ajuste/anulación es **inmutable** (no se borra, D7/D22).
- Dos formas de modificar: **ajuste manual** (`+`/`−` con motivo) y **anulación de movimiento**
  (soft-delete que recalcula el saldo).

> Alternativa descartada: restringir a cada admin solo a movimientos de su propia sede. Se descartó por
> ser incoherente con un saldo compartido y porque la auditoría ya da el control necesario.

---

## Resumen de lo que bloquea el diseño

**✅ Todas las decisiones están cerradas.** El resto (D5, D8–D11, D13–D20) ya tenía recomendación
firme y queda como está. El plan (`CARBOPUNTOS-PLAN.md`) está listo para ejecutar.
