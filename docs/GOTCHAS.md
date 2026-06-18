# Trampas recurrentes y lecciones

Estos son los patrones de bug que aparecieron repetidamente. Revisalos antes de
tocar dinero, fechas, rutas o sincronización.

## 1. Decimales de TypeORM llegan como STRING

Las columnas `decimal` (price, amount, commissionPercentage, grossAmount, ...) se
serializan como `"15.50"` aunque el tipo TS diga `number`. Síntomas:

- `0 + "15.50"` → concatenación `"015.50"` en sumas.
- `unitPrice: product.price` → la API rechaza con 400 ("expected number, received string").
- `commissionPercentage * total` → `NaN`.

**Regla:** coercionar a `Number(...)` en la frontera del frontend (los `*.api.ts`
normalizan price/commission) Y usar `z.coerce.number()` en los contratos para
montos. Cualquier campo monetario que cruce API↔front es sospechoso.

## 2. Zona horaria: agrupar por día en GMT-5, no en UTC

El servidor (contenedor) corre en UTC; los timestamps son `timestamptz`. Bugs:

- `new Date('2026-06-17')` o `'2026-06-17T00:00:00'` (sin offset) = medianoche UTC,
  no Lima → ventana corrida 5h, o rango de ancho cero que oculta el día entero.
- `DATE_TRUNC('day', createdAt)` sin TZ parte el día Lima a medianoche UTC.
- `new Date(year, month, day)` en el server usa hora local del server (UTC).

**Regla:** anclar a `America/Lima` (UTC-5, sin DST). Mandar fechas con `-05:00`,
o solo-fecha que el backend expande con `resolveRangeStart/End`. En SQL usar
`AT TIME ZONE 'America/Lima'`. Para "hoy" usar
`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' })`.

## 3. Rutas y el prefijo `/api`

- El controller con `@Controller()` vacío mapea a `/api/<método>`, no a
  `/api/<recurso>/<método>`. Siempre poner el prefijo del recurso.
- `/api/sales/payment-methods` caía en `GET sales/:id` → `ParseIntPipe` → 400.
  Rutas literales antes que `:id`.
- `/health` está EXCLUIDO del prefijo `/api` (healthcheck Docker/Coolify). El
  frontend lo alcanza con baseURL override + proxy de vite.
- Hay un test que blinda esto: `apps/api/src/route-contract.spec.ts`. Si agregás
  o renombrás una ruta clave, actualizalo.

## 4. Invalidación de React Query tras mutar

Una venta/gasto cambia ventas, dashboard, caja Y BI. Invalidar solo `['sales']`
deja el dashboard/BI con datos viejos ("no se actualiza en tiempo real").
**Regla:** usar `invalidateFinancialQueries(qc)` en TODA mutación de venta/gasto/reset
(incluido `use-sync` tras sincronizar la cola offline).

## 5. Forma de respuesta (no solo la ruta)

- `GET /sales` devuelve `{ data, total }` paginado, NO un array. Consumirlo como
  array crashea/queda vacío.
- `syncSales/syncExpenses` devuelven `{ success, skipped, failed[], message }`.
  Leer `result.failed` sin ese shape → TypeError que el `catch` traga → la cola
  offline nunca sincroniza.
  Un test de rutas NO atrapa mismatches de forma; solo un e2e con datos reales o
  tests de schema/hook.

## 6. FK por cascade de TypeORM

`save(sale)` con `sale.payments = [...]` y `cascade: true` insertaba los payments
con `sale_id` null (violación not-null). **Regla:** para operaciones críticas,
transacción explícita seteando el FK a mano (ver `createSale`).

## 7. Verificar SIEMPRE el trabajo de sub-agentes

Un sub-agente de fix reportó haber aplicado 8 cambios con "CI verde" pero
`git status` mostró **cero archivos modificados** — alucinó el reporte completo.
**Regla:** después de delegar, verificar contra el código real (`git status`,
`git diff`, leer el archivo, correr el CI uno mismo) antes de confiar.

## 8. Auth / password

- No hay `@BeforeInsert` en la entidad User (se removió: era un trap de
  doble-hash). El hashing es responsabilidad del controller/seed + QB insert.
- El `JwtStrategy` valida `isActive` en cada request → si un usuario se desactiva
  a sí mismo queda bloqueado sin recuperación. Hay guard que lo previene.

## 9. commitlint

El subject del commit debe ir en minúsculas. Siglas en mayúscula (GMT-5, BI al
inicio) lo rompen. Si el commit falla, reescribir el subject en minúsculas.

## Pendiente / follow-up recomendado

- **e2e con Postgres real** (supertest): crear venta vía API y verificar
  dashboard/egresos/sync. Es lo único que atrapa las clases 1, 2, 5, 6 antes de
  producción (los tests de schema/ruta no las ven).
