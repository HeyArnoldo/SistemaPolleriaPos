# Dominios — cómo funciona cada cosa

Convención de rutas: todas con prefijo global `/api` (excepto `/health`).

## Auth (`apps/api/src/auth`, `apps/web/src/hooks/use-auth.ts`)

- `POST /auth/login` (username + password) → setea cookie JWT httpOnly.
- `GET /auth/me` → usuario actual (o 401). `POST /auth/logout` → borra cookie.
- Frontend: `useMe`, `useLogin`, `useLogout`. `ProtectedRoute` envuelve las rutas
  privadas. `RoleRoute` gatea por rol (admin vs cashier).

## Users (`apps/api/src/users`, `apps/web/src/pages/usuarios.tsx`)

- `GET /users`, `POST /users`, `PATCH /users/:id`. **No hay DELETE**: la baja es
  soft-delete vía `PATCH { isActive: false }`.
- El controller hashea el password (bcryptjs) antes de llamar al service.
- Guard: no se puede desactivar la propia cuenta (evita lockout del único admin).
- `updateUserSchema` incluye `isActive` (si no, el ZodValidationPipe lo descarta).

## Inventory — productos y categorías (`apps/api/src/inventory`)

- Controller en `inventory` → `/api/inventory/products`, `/api/inventory/categories`.
- Productos: list/create/update + **desactivar** (`isActive: false`) y **reactivar**
  (`isActive: true`) vía PATCH. `price` es decimal → se normaliza a número en
  `products.api.ts`.
- Frontend: `useGetProducts/useGetCategories`, `ProductosTable` con filtros
  (búsqueda, categoría, estado) + `ProductFormDialog`.

## Payment methods (`apps/api/src/sales/payment-method.controller.ts`)

- `@Controller('payment-methods')` → `/api/payment-methods` (todos),
  `/api/payment-methods/active` (solo activos). El **checkout usa `/active`**.
- `commissionPercentage` es decimal → se normaliza a número en el frontend.
- Los métodos los usan ventas Y egresos (recurso compartido, top-level).

## Sales — ventas (`apps/api/src/sales`, `apps/web/src/pages/ventas.tsx`)

- `POST /sales` (crear), `GET /sales` (lista paginada `{ data, total }`),
  `PATCH /sales/:id/cancel`, `POST /sales/sync` (cola offline),
  `GET /sales/export/cash-report` (Excel ExcelJS), `DELETE /sales/reset/all`,
  `DELETE /sales/reset/date/:date` (admin, transaccional).
- **`createSale` es transaccional**: guarda la venta, luego cada item/payment con
  el FK `sale` seteado a mano (no confía en cascade — el cascade dejaba `sale_id`
  null). Calcula comisión por método.
- Cart/pagos (frontend): `usePaymentState` con modo **único / mixto**
  (Yape/Plin + Efectivo), comisiones (neto↔bruto), y `buildPaymentsPayload()`
  que produce `CreatePaymentDTO[]`. La grilla solo muestra métodos activos.
- Impresión: tras la venta, `getPrintSettings()` → `buildTicketHtml(sale, settings)`
  → preview en dialog o `printTicket` (Electron silencioso / `window.print` web).

## Cash — egresos y dashboard (`apps/api/src/cash`)

- Egresos: `POST /cash/expenses`, `POST /cash/expenses/sync`,
  `GET /cash/expenses?startDate&endDate`, `DELETE /cash/expenses/:id`.
- **Dashboard**: `GET /cash/dashboard?date=YYYY-MM-DD` → `CashDashboardResponse`
  `{ summary[] (por método), totals, transactions[] }`, agregando ventas+egresos
  del día en **GMT-5**. Excluye ventas anuladas (`isCanceled = false`).
- Los rangos de fecha solo-fecha se expanden al día Lima completo
  (`resolveRangeStart/resolveRangeEnd` en `cash.service.ts`).

## BI — analítica (`apps/api/src/cash/bi.controller.ts`, `apps/web/src/pages/historial.tsx`)

- `GET /bi/summary | /detail | /commissions | /trends`. Admin-only.
- Query: período (today/week/month/year), groupBy (day/week/month),
  paymentMethodIds, page/limit. Validado con Zod (`biQuerySchema`).
- **Períodos y trends anclados a Lima**: `resolvePeriod` usa la fecha calendario
  de Lima; `getTrends` usa `DATE_TRUNC(... AT TIME ZONE 'America/Lima')`.

## Settings (`apps/api/src/settings`)

- `GET /settings`, `PATCH /settings` (nombre de la tienda).

## Offline-first (objetivo: vender + imprimir sin internet, target = desktop)

El target real de offline es la **app de escritorio (Electron)**; en web el primer
load siempre necesita internet. La arquitectura tiene 4 piezas:

1. **Desktop fat client** (`apps/desktop/electron/main.ts`). El Electron **NO carga
   la web remota** (sin internet fallaba): empaqueta la web y la sirve local vía un
   protocolo `app://` con fallback a `index.html` (mantiene BrowserRouter). Así la
   app **siempre abre**. Solo el **API URL** se configura por tenant en runtime
   (`config.json` → `apiUrl`; el setup pide la URL del API; el preload expone
   `electronAPI.apiUrl` vía `sendSync('get-api-url')`). El build copia
   `apps/web/dist` → `dist-electron/web` (`scripts/copy-web.mjs`) antes de
   electron-builder. En la web, `lib/api.ts` resuelve la base de
   `electronAPI.apiUrl || VITE_API_URL` (el deploy web no se afecta).
2. **Catálogo persistido** (`lib/query-persister.ts`, `main.tsx`). TanStack Query
   persistence (localStorage) **solo** de las keys del catálogo
   (`products`, `categories`, `payment-methods`, `settings`) — no auth/ventas/BI.
   `gcTime` 7d. Así los productos cargan offline desde un arranque en frío.
3. **PIN global de acceso offline** (`lib/offline-pin.ts`, Configuración). El admin
   configura **un PIN de 4-6 dígitos** desde Configuración (`OfflinePinCard`,
   admin-only) → `saveGlobalOfflinePin` guarda una sesión genérica de **cajero**
   en IndexedDB. Sin internet, el `login` muestra "Ingresar sin conexión" → PIN →
   `OfflinePinScreen` → modo offline (rol cajero, nav restringido a Ventas+Egresos).
   `ProtectedRoute` también muestra el PIN al entrar offline a una ruta protegida.
4. **Cola + sync** (`hooks/use-sync.ts`). Ventas/egresos se encolan en IndexedDB
   (Dexie: `queuedSales`, `queuedExpenses`). Al reconectar
   (`useConnectivity.onReconnect`), `syncNow()` los envía a `/sales/sync` y
   `/cash/expenses/sync` (devuelven `{ success, skipped, failed[], message }`),
   marca sincronizados los que no fallan, e invalida las queries financieras. El
   flujo es: vuelve internet → re-login → sync; las ventas offline se atribuyen al
   cajero que se re-loguea (por eso no hace falta cambio de atribución en backend).

`useConnectivity` expone `isOnline` + `hasCheckedHealth` (para no decidir
login-vs-PIN antes del primer health check real). Imprimir offline funciona vía
Electron (local), no necesita internet.

## Shell / UI (`apps/web/src/layouts/app-layout.tsx`)

- Sidebar oscuro de marca + navbar (breadcrumb, reloj, SyncStatus). Contenido claro.
- Login: fondo oscuro + header de marca (logo) + form claro. Favicon `logo.svg`.
