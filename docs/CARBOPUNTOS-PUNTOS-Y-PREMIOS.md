# CARBOPUNTOS — Puntos, premios e integración DNI (referencia)

> Valores reales del prototipo y del levantamiento. Es config **por sede** (cada sede puede editar la
> suya); estos son los valores de arranque. Acompaña a `CARBOPUNTOS-DECISIONES.md` y `-PLAN.md`.

## 1. Puntos al comprar (categoría Pollos)

| Producto                             | Precio (S/.) | Puntos |
| ------------------------------------ | ------------ | ------ |
| 1/8 pollo                            | 11.00        | 5      |
| 1/4 pollo                            | 20.00        | 10     |
| 1/2 pollo                            | 40.00        | 15     |
| Pollo entero                         | 73.00        | 20     |
| Salchipapa, bebidas, combos no-pollo | —            | 0      |

**Modelo de datos que esto implica (resuelve D3 = opción A):** cada producto tiene un campo
`puntaje` entero, configurable por sede, **default 0**. Los puntos de una venta = `Σ (puntaje_producto × cantidad)`
sobre sus líneas. No hay lógica por categoría: que "solo Pollos dé puntos" es simplemente el resultado
de tener `puntaje > 0` solo en esos productos.

### Combos (pregunta que dejaste pendiente) — recomendación

> "Los combos (1/4 COMBO, 1/8 COMBO) acumulan por la porción de pollo que incluyen."

**Recomendación:** no se necesita lógica especial de combos. Se configura el `puntaje` del propio
combo con los puntos de su porción de pollo (ej. `1/4 COMBO → 10 pts`, `1/8 COMBO → 5 pts`). Así el
cálculo sigue siendo "suma del puntaje de cada línea" y queda explícito y editable por sede.
**Tu confirmación:** \_\_\_ (si prefieres que el combo dé los puntos de su porción, esto ya lo cubre)

## 2. Premios al canjear (catálogo de arranque)

| Premio              | Costo (puntos) |
| ------------------- | -------------- |
| Gaseosa 1 LT        | 100            |
| Jarra de limonada   | 140            |
| Jarra de chicha     | 170            |
| 1/8 pollo gratis    | 200            |
| Pollo entero gratis | 400            |

El premio es un **beneficio en puntos, no dinero** (confirma D4 = opción A): el ítem gratis va al
ticket como cortesía (S/. 0), **no baja el neto de caja en soles**, y se descuentan sus puntos. El
ítem canjeado **no genera puntos** (es gratis).

## 3. Ejemplo de operación mixta (del prototipo)

Cliente con 250 pts compra 1/2 pollo (gana 15) y canjea 1/8 pollo gratis (−200):

- Operación neta de puntos: `+15 − 200 = −185`
- Saldo final: `250 − 185 = 65`
- En el ticket: **Antes 250 · Operación −185 · Ahora 65**
- En caja (soles): solo el 1/2 pollo (S/. 40); el 1/8 va como cortesía S/. 0.

Esto fija el formato del bloque de puntos en el ticket: **Antes / Operación / Ahora**.

## 4. Integración API de DNI — json.pe (resuelve D12)

- **Endpoint:** `POST https://api.json.pe/api/dni`
- **Auth:** header `Authorization: Bearer <APIKEY>` (la apikey la provee el negocio; vive solo en el hub).
- **Request:** `{ "dni": "27427864" }` — string de exactamente 8 dígitos (`^[0-9]{8}$`).
- **Respuesta 200:**
  ```json
  {
    "success": true,
    "message": "exito",
    "data": {
      "numero": "27427864",
      "nombres": "JOSE PEDRO",
      "apellido_paterno": "CASTILLO",
      "apellido_materno": "TERRONES",
      "nombre_completo": "CASTILLO TERRONES, JOSE PEDRO",
      "direccion": "",
      "direccion_completa": "",
      "ubigeo_reniec": "",
      "ubigeo_sunat": ""
    }
  }
  ```
- **Respuesta 404:** `{ "success": false, "message": "No se encontró DNI" }` (DNI inexistente,
  credenciales inválidas o sin auth).

Decisiones de diseño derivadas:

- El **hub** centraliza la integración (una sola apikey, env `JSONPE_API_KEY`). Las sedes nunca llaman
  a json.pe directo.
- Se guarda en `Customer`: `nombre_completo` (o `nombres` + apellidos) **tal cual** (RN-05), y el `dni`.
- Se consulta json.pe **solo la primera vez** que se afilia un DNI; luego el cliente ya vive en el hub
  y no se vuelve a consultar (RF-24/D13).
- Validar el DNI con el patrón de 8 dígitos antes de llamar (evita gastar llamadas).
