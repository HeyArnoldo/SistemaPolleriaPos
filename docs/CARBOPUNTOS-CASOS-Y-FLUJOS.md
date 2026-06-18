# CARBOPUNTOS — Casos y flujos

> Propósito: enumerar cada flujo operativo y cada caso borde, con su comportamiento esperado, ANTES
> de codificar. Las decisiones referenciadas (Dx) viven en `CARBOPUNTOS-DECISIONES.md`.
> Convención: 🌐 requiere conexión al hub · 📴 funciona offline · ⚠️ caso borde / riesgo.

---

## 1. Flujos principales

### F1 — Venta normal sin cliente 📴

1. Cajero arma el carrito y cobra (simple o mixto).
2. La venta se registra en la **DB local de la sede** (online directo; offline se encola por `saleNumber`).
3. No toca el hub. RN-12: sin cliente, no hay puntos.
   > Funciona igual con o sin internet. Es el flujo que nunca debe romperse (RNF-04).

### F2 — Afiliación de cliente nuevo 🌐

1. Cajero ingresa DNI.
2. La sede consulta al hub: ¿existe este DNI?
3. Si **no existe** → el hub consulta la **API externa de DNI** (D12) → devuelve nombre.
4. Cajero registra teléfono (opcional) y obtiene **consentimiento** del cliente (D10).
5. El hub crea el `Customer` (nombre tal cual de la API, saldo 0).
   > Requiere hub + API DNI online. Offline no se puede afiliar (ver C1).

### F3 — Vinculación de cliente existente 🌐

1. Cajero ingresa DNI (o busca por nombre/teléfono — RF-52).
2. El hub lo encuentra y devuelve nombre + **saldo actual**.
3. La venta queda vinculada a ese cliente (`customer_dni` en la venta local — D20).
   > Requiere hub online. No necesita API DNI (el cliente ya está en el hub — D13).

### F4 — Venta con acumulación 🌐

1. Cliente vinculado (F3) o recién afiliado (F2).
2. Cajero arma el carrito; la sede calcula los **puntos a ganar** (D3, suma por producto).
3. La UI muestra **puntos a ganar** y **saldo proyectado** en tiempo real (RF-29/RF-30/RNF-02).
4. Al cobrar: la venta se registra local + el hub registra el **movimiento de acumulación** (idempotente — D15).
   > Si el hub no responde en el timeout (D18): la venta se cierra **sin puntos** y el movimiento queda en la **cola de pendientes** (D16) para reintento.

### F5 — Solo canje (sin venta monetaria) 🌐

1. Cliente vinculado; cajero ve el saldo.
2. Selecciona premio(s) del catálogo **de la sede** (D2); la UI calcula el costo en puntos.
3. Si saldo insuficiente → bloquear (RF-34, ver C9).
4. **Confirmación explícita** (RF-39/RN-14) → el hub registra el **canje** (débito) transaccional (D17).
   > Nunca offline (C1). El premio no afecta el dinero de caja si D4=A.

### F6 — Operación mixta: venta + canje 🌐

1. Cliente vinculado; carrito con productos + premio(s) a canjear.
2. La UI muestra: puntos a ganar por la compra, puntos a descontar por el canje, y **saldo neto proyectado** (RF-36/RF-37).
3. Cajero puede **quitar premios antes de confirmar** (RF-38).
4. Al confirmar: el hub registra **ambos movimientos vinculados** (acumulación + canje) en una sola transacción.
   > Si parte falla, la transacción del hub no debe dejar el saldo a medias (atomicidad).

### F7 — Consulta de cliente / saldo en caja 🌐

1. Búsqueda por DNI/nombre/teléfono (RF-51/RF-52).
2. Muestra saldo actual + historial reciente (RF-53/RF-54/RF-50).
   > Lectura rápida apoyada en saldo materializado (RNF-01).

### F8 — Administración de cliente: ver y modificar puntos (admin) 🌐 (D25)

1. Admin (de cualquier sede) abre el detalle del cliente y ve el **saldo global** + **historial
   completo cross-sede** (cada movimiento muestra su sede de origen).
2. **Modificar puntos** — dos formas, solo admin (el cajero no puede, RF-70):
   - **Ajuste manual** (`+`/`−`) con **motivo obligatorio** (el `AdjustModal` del prototipo).
   - **Anular un movimiento** (soft-delete) con motivo; el saldo se recalcula.
3. La sede llama al hub (`/points/adjust` o `/movements/:id/void`) con la identidad del admin y la sede.
   El hub aplica transaccional con bloqueo (D17), **nunca deja negativo** (D6), y escribe:
   - un `PointsMovement` (inmutable) + una entrada `AdminAudit` con `actor`, `sede`, `fecha`,
     `saldo_anterior`, `saldo_posterior`, `motivo`.
4. El cambio se refleja **al instante en todas las sedes** (saldo único global).
   > Cualquier admin puede ajustar a cualquier cliente; el control es la **auditoría visible para todos
   > los admins** (quién, qué sede, cuándo, antes/después, motivo). Ver es de lectura; modificar exige rol admin.

---

## 2. Casos borde y de error

### C1 — Offline: cliente quiere puntos pero no hay conexión 📴⚠️

- No se puede afiliar, ni consultar saldo, ni canjear.
- **Comportamiento:** la venta se cierra **anónima** (F1). Si D1=A y el cajero capturó el DNI, se guarda el `customer_dni` en la venta encolada para **acumulación retroactiva** al sincronizar (ver C2). El **canje queda deshabilitado** en la UI cuando no hay hub.

### C2 — Acumulación retroactiva al reconectar 🌐⚠️ (depende de D1=A)

- Al volver la conexión, primero se sincronizan las ventas (`/sales/sync`, idempotente por `saleNumber`).
- Luego, por cada venta sincronizada con `customer_dni`, la sede envía el **movimiento de acumulación** al hub (idempotente — D15).
- Si el cliente no estaba afiliado, la acumulación retroactiva **no puede crear el cliente sin la API DNI**; queda pendiente o se descarta según D1. (A definir el detalle fino.)

### C3 — Hub caído estando online 🌐⚠️

- Toda llamada de puntos pasa por `@app/carbopuntos-client` con timeout (D18).
- **Comportamiento:** la venta se cierra sin puntos; el movimiento va a la cola de pendientes (D16). El canje se bloquea (no se puede gastar lo que no se puede verificar). Mensaje claro al cajero (RNF-05).

### C4 — API DNI caída pero hub online 🌐⚠️

- Cliente **existente**: funciona (no necesita la API — D13).
- Cliente **nuevo**: no se puede afiliar; se informa y se reintenta luego. La venta sin puntos no se bloquea.

### C5 — Cancelación de venta que acumuló puntos 🌐⚠️ (D5)

- Al cancelar, el hub registra una **reversa** que resta los puntos acumulados por esa venta.
- Idempotente: cancelar dos veces no resta dos veces.
- Si el hub no responde, la reversa va a la cola de pendientes (D16).

### C6 — Cancelación cuando el cliente ya gastó esos puntos 🌐⚠️ (D5+D6 resueltos)

- La reversa excedería el saldo disponible.
- **Comportamiento:** el saldo **se topa en 0** (nunca negativo — D6); la diferencia no recuperada se
  registra en el movimiento de reversa para auditoría. No se bloquea la cancelación de la venta.

### C7 — Doble sincronización por red intermitente 🌐⚠️

- La venta ya es idempotente por `saleNumber` (el servidor responde `skipped`).
- Los movimientos de puntos deben ser igual de idempotentes (D15): la clave `{saleNumber, sede, tipo}` evita acumular/canjear doble.

### C8 — Dos sedes canjeando el mismo saldo a la vez 🌐⚠️

- **Comportamiento:** el hub serializa con transacción + bloqueo (D17). El segundo canje ve el saldo ya actualizado; si queda insuficiente, se rechaza. **Esta es la razón de ser del hub central** (evitar doble gasto).

### C9 — Canje con saldo insuficiente 🌐

- Se bloquea antes de confirmar (RF-34/RN-13). La UI no permite seleccionar premios que excedan el saldo, y el hub revalida en el servidor (defensa en profundidad).

### C10 — DNI no encontrado o inválido en la API 🌐

- Se informa al cajero; no se crea cliente. La venta puede continuar anónima.

### C11 — Cliente sin DNI quiere puntos 📴/🌐

- No permitido (D9). Venta normal anónima.

### C12 — Ajuste manual que deja saldo negativo 🌐⚠️

- Permitido solo a admin con motivo (D8); el resultado (incluido negativo) queda auditado. Coherente con D6.

### C13 — Premio definido en una sede, cliente canjea en otra 🌐⚠️ (depende de D2)

- Si D2=A (catálogo local): cada sede solo ofrece **sus** premios; el cliente canjea de la oferta de la sede donde está. El saldo es global, la oferta es local. No hay conflicto.
- Si D2=B (catálogo central): el premio es el mismo en las tres.

### C14 — Movimiento pendiente que nunca confirma 🌐⚠️

- La cola de pendientes (D16) reintenta con backoff. Si tras N intentos sigue fallando, se marca para revisión del admin (visible, no se pierde). Evita acumulaciones/canjes "fantasma".

### C15 — Reintento de reversa sobre venta nunca acumulada (offline→cancel offline) 🌐⚠️

- Una venta creada y cancelada **ambas offline** llega al hub como "cancelada" sin que se haya acumulado nada.
- **Comportamiento:** el hub, al recibir la reversa, valida que exista el movimiento de acumulación previo (por la clave idempotente). Si no existe, **no hace nada** (no genera saldo negativo espurio).

---

## 3. Matriz online/offline (resumen)

| Operación                  | Online (hub OK) | Hub caído          | Offline total         |
| -------------------------- | --------------- | ------------------ | --------------------- |
| Venta sin cliente          | ✅              | ✅ (local)         | ✅ (encolada)         |
| Afiliar cliente nuevo      | ✅              | ❌ informar        | ❌                    |
| Vincular cliente existente | ✅              | ❌ informar        | ❌                    |
| Acumular puntos            | ✅              | ⏳ cola pendientes | ⏳ retroactivo (D1=A) |
| Canjear premio             | ✅              | ❌ bloqueado       | ❌ bloqueado          |
| Consultar saldo            | ✅              | ❌ no disponible   | ❌ no disponible      |
| Reversa por cancelación    | ✅              | ⏳ cola pendientes | ⏳ al sincronizar     |

> Regla de oro: **el dinero (venta local) nunca se bloquea por el hub**; **los puntos nunca se gastan sin el hub**.
