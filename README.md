# 🍗 Sistema POS — Pollería Carbón

Punto de venta para la cadena de pollerías **Pollería Carbón**: registrá ventas
en segundos, cobrá con efectivo o billeteras digitales (Yape/Plin) con cálculo
de comisiones, imprimí el ticket, y mirá la caja del día en tiempo real. Sigue
funcionando **sin internet** y sincroniza solo cuando vuelve la conexión.

Es un **monorepo pnpm** con API, web y app de escritorio compartiendo los mismos
contratos de datos.

## ✨ Funcionalidades

- 🛒 **Ventas rápidas** con grilla de productos, filtros por categoría y carrito.
- 💳 **Pago único o mixto** (Yape/Plin + Efectivo) con comisiones y vuelto.
- 🧾 **Impresión de tickets** silenciosa vía la app de escritorio (Electron).
- 💰 **Caja y dashboard** con resumen por método de pago, egresos y neto del día.
- 📊 **BI / Historial**: ventas, comisiones y tendencias por período.
- 📦 **Productos, categorías, métodos de pago y usuarios** administrables.
- 📴 **Modo offline**: ventas/egresos se encolan localmente (IndexedDB) y se
  sincronizan al reconectar; PIN para seguir operando sin internet.
- 🔐 **Auth por usuario** con roles (Admin / Cajero), JWT en cookie httpOnly.

## 📚 Documentación

| Para…                         | Mirá                                            |
| ----------------------------- | ----------------------------------------------- |
| Levantar el proyecto          | este README (más abajo)                         |
| Entender cómo está armado     | [`CLAUDE.md`](CLAUDE.md) — mapa + reglas de oro |
| Arquitectura y flujo de datos | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)  |
| Convenciones de código        | [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)    |
| Cómo funciona cada dominio    | [`docs/DOMAINS.md`](docs/DOMAINS.md)            |
| Trampas conocidas (¡leelas!)  | [`docs/GOTCHAS.md`](docs/GOTCHAS.md)            |

> 💡 Si vas a tocar código, leé `docs/` primero. Te ahorra escarbar y evita
> romper convenciones (zona horaria, decimales, contratos, invalidación de caché).

## 🧱 Stack

| Capa      | Tecnología                                                   |
| --------- | ------------------------------------------------------------ |
| Backend   | NestJS 11 · TypeORM · PostgreSQL 16                          |
| Frontend  | React 19 · Vite 7 · Tailwind v4 · shadcn/ui · TanStack Query |
| Desktop   | Electron 36 (impresión de tickets)                           |
| Contratos | Zod compartidos (misma validación en API y web)              |
| Monorepo  | pnpm 11 · commits convencionales                             |

---

## Requisitos previos

| Herramienta    | Versión mínima | Cómo verificar           |
| -------------- | -------------- | ------------------------ |
| Node.js        | 22             | `node -v`                |
| pnpm           | 11             | `pnpm -v`                |
| Docker         | 24             | `docker -v`              |
| Docker Compose | v2             | `docker compose version` |

**Instalar pnpm** (si no lo tienes):

```bash
npm install -g corepack
corepack enable
corepack prepare pnpm@latest --activate
```

---

## Desarrollo local

### 1. Clonar y configurar

```bash
git clone https://github.com/HeyArnoldo/SistemaPolleriaPos.git
cd SistemaPolleriaPos

cp .env.example .env
```

Abre `.env` y ajusta al menos estas variables:

```env
JWT_SECRET=cambia_esto_por_algo_largo_y_aleatorio
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TuPasswordSeguro123!
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Levantar la base de datos

```bash
pnpm db:up        # Levanta PostgreSQL en Docker (puerto 5432)
```

Para abrir Adminer (UI visual de la base de datos):

```bash
docker compose --profile tools up -d
# Abre http://localhost:8081
# Sistema: PostgreSQL | Servidor: db | Usuario/Contraseña/BD: según tu .env
```

### 4. Compilar contratos y correr migraciones

```bash
pnpm --filter @app/contracts build   # Requerido antes del primer arranque

pnpm migration:run    # Crea todas las tablas
pnpm seed             # Crea el admin + productos de ejemplo (es idempotente, seguro correrlo varias veces)
```

### 5. Iniciar en modo desarrollo

```bash
pnpm dev
# API disponible en:  http://localhost:3000
# Web disponible en:  http://localhost:5173
```

Entra con el `ADMIN_USERNAME` y `ADMIN_PASSWORD` que configuraste en `.env`.

---

## Variables de entorno

El archivo `.env.example` tiene todas las variables documentadas. Las más importantes:

| Variable                            | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Ejemplo                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `DB_HOST`                           | Host de PostgreSQL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `localhost`                 |
| `DB_PORT`                           | Puerto de PostgreSQL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `5432`                      |
| `DB_USER`                           | Usuario de la base de datos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `app`                       |
| `DB_PASSWORD`                       | Contraseña de la base de datos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `app`                       |
| `DB_NAME`                           | Nombre de la base de datos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `sistema_polleria_pos`      |
| `JWT_SECRET`                        | Clave secreta para JWT (mín. 32 chars)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `openssl rand -base64 32`   |
| `JWT_EXPIRES_IN`                    | Duración de la sesión                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `7d`                        |
| `CORS_ORIGIN`                       | URL del frontend (en producción)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `https://pos.tudominio.com` |
| `FRONTEND_URL`                      | Igual que CORS_ORIGIN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `https://pos.tudominio.com` |
| `ADMIN_USERNAME`                    | Usuario del admin inicial                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `admin`                     |
| `ADMIN_PASSWORD`                    | Contraseña del admin inicial                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Admin1234!`                |
| `SYSTEM_USER_PASSWORD`              | Contraseña del usuario "sistema" (soporte técnico inamovible). Si no se define, el seed omite ese usuario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `SoporteSeguro123!`         |
| `STORE_ID`                          | Identificador de la sede para esta instancia del API. Se registra en cada fila del audit de login. Este POS corre una instancia del API por sede.                                                                                                                                                                                                                                                                                                                                                                                                                                  | `sede-lima-01`              |
| `COOKIE_SECURE`                     | `true` en producción, `false` en local                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `true`                      |
| `COOKIE_SAMESITE`                   | `lax` para dominios iguales                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `lax`                       |
| `BCRYPT_ROUNDS`                     | Rondas de hash (12 es suficiente)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `12`                        |
| `LOGIN_LOCKOUT_MAX_FAILURES`        | Intentos fallidos dentro de la ventana de tiempo antes de bloquear una identidad. El sistema usa una **ventana deslizante**: cuando pasa suficiente tiempo, los intentos antiguos quedan fuera de la ventana y el acceso se restaura automáticamente. Comportamiento **fail-open**: si la consulta de conteo falla (error de DB transitorio), el bloqueo se omite y la autenticación normal continúa — un error de DB no bloquea a todos los usuarios.                                                                                                                             | `5`                         |
| `LOGIN_LOCKOUT_WINDOW_MINUTES`      | Duración de la ventana deslizante en minutos. También es el tiempo de enfriamiento efectivo: una identidad bloqueada recupera el acceso automáticamente cuando sus intentos anteriores quedan fuera de la ventana (no se requiere desbloqueo manual).                                                                                                                                                                                                                                                                                                                              | `15`                        |
| `LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES` | Umbral de bloqueo más alto para el usuario `sistema` (soporte técnico inamovible). El usuario `sistema` nunca queda bloqueado de forma permanente: al ser una ventana deslizante, esperar el tiempo de la ventana siempre restaura el acceso. Valor predeterminado más permisivo para evitar bloquear el acceso de soporte durante un incidente.                                                                                                                                                                                                                                   | `20`                        |
| `LOCKOUT_ALERT_CHANNEL`             | Canal de entrega de alertas cuando se dispara un bloqueo. Actualmente solo está disponible `log` (escribe una línea de log estructurada y persiste un registro en `login_lockout_alert`; no requiere infraestructura externa). Valores desconocidos o no definidos también usan `log`. Canales futuros como `email` o `webhook` se agregarán en futuras versiones y requerirán variables adicionales (`SMTP_*` o `LOCKOUT_ALERT_WEBHOOK_URL` — diferidos, no configurados en esta versión).                                                                                        | `log`                       |
| `TOTP_ENCRYPTION_KEY`               | **Requerida para habilitar la inscripción TOTP (2FA).** Clave AES-256 de 32 bytes codificada en base64 o hex. Sin esta clave los endpoints `/auth/2fa/enroll` y `/auth/2fa/enroll/confirm` devuelven `503`. El login con contraseña no se ve afectado. Generar con: `openssl rand -base64 32`. Configurar en Coolify como variable de entorno secreta; **nunca en el repositorio**.                                                                                                                                                                                                | `openssl rand -base64 32`   |
| `SYSTEM_TOTP_SECRET`                | Secreto TOTP en base32 para el usuario `sistema` (break-glass de Groow). Cuando se define junto con `TOTP_ENCRYPTION_KEY`, el seed crea al usuario `sistema` con 2FA habilitado y el secreto almacenado cifrado. Groow guarda este valor fuera del repositorio y lo configura en Coolify. Si no está definido (o falta `TOTP_ENCRYPTION_KEY`), el usuario `sistema` se crea sin 2FA y el seed emite un log de advertencia. Obtener un secreto base32 con cualquier app de autenticación o con: `python3 -c "import base64, os; print(base64.b32encode(os.urandom(20)).decode())"`. | —                           |
| `TOTP_ISSUER`                       | Etiqueta del emisor que aparece en la app de autenticación (Google Authenticator, Authy, etc.). Valor predeterminado: `Pollería Carbón POS`.                                                                                                                                                                                                                                                                                                                                                                                                                                       | `Pollería Carbón POS`       |
| `TOTP_WINDOW`                       | Tolerancia de reloj en pasos de tiempo (1 paso = 30 s). Permite compensar pequeñas diferencias de reloj entre el servidor y el dispositivo del usuario. Predeterminado: `1` (acepta el código actual y el inmediatamente anterior/siguiente). Aumentar solo si hay problemas persistentes de sincronización de reloj.                                                                                                                                                                                                                                                              | `1`                         |

---

## Comandos útiles

```bash
# Desarrollo
pnpm dev                    # Levanta API + web en paralelo
pnpm dev:api                # Solo la API
pnpm dev:web                # Solo el frontend

# Base de datos
pnpm db:up                  # Levanta PostgreSQL
pnpm db:down                # Para PostgreSQL
pnpm migration:run          # Aplica migraciones pendientes
pnpm migration:revert       # Revierte la última migración
pnpm seed                   # Carga datos iniciales (idempotente)

# Agregar una migración (después de editar una entity)
pnpm migration:generate src/database/migrations/NombreDescriptivo
# Revisar el SQL generado antes de aplicar
pnpm migration:run

# Calidad de código
pnpm lint                   # ESLint en todos los workspaces
pnpm typecheck              # TypeScript en todos los workspaces
pnpm test                   # Tests
pnpm build                  # Build completo (contracts → api → web → desktop)
```

---

## Deploy en producción (Docker)

Cada servidor solo necesita Docker y Docker Compose. El proceso de arranque aplica migraciones y el seed automáticamente — no hay pasos manuales.

### Preparar el servidor

```bash
# En el servidor (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### Desplegar

```bash
# Clonar el repositorio en el servidor
git clone https://github.com/HeyArnoldo/SistemaPolleriaPos.git
cd SistemaPolleriaPos

# Crear el archivo de entorno
cp .env.example .env
nano .env   # Editar con los valores de producción (ver tabla abajo)
```

**Variables de entorno para producción:**

```env
NODE_ENV=production

# Base de datos
DB_HOST=db
DB_PORT=5432
DB_USER=app
DB_PASSWORD=PasswordMuySeguro123!
DB_NAME=sistema_polleria_pos

# URLs (reemplazar con el dominio real)
CORS_ORIGIN=https://pos.tudominio.com
FRONTEND_URL=https://pos.tudominio.com

# Seguridad
JWT_SECRET=genera_uno_con_openssl_rand_-base64_32
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
BCRYPT_ROUNDS=12

# Admin inicial
ADMIN_USERNAME=admin
ADMIN_PASSWORD=PasswordDelAdmin123!

# Usuario "sistema" (soporte técnico inamovible). Omitir si no se necesita.
SYSTEM_USER_PASSWORD=SoporteSeguro123!

# Identificador de esta sede/sucursal (se registra en el audit de login)
STORE_ID=sede-lima-01

# Bloqueo de login por intentos fallidos (CP-02)
# Ventana deslizante: el bloqueo se levanta automáticamente al pasar el tiempo configurado.
# Comportamiento fail-open: un error de DB en el conteo nunca bloquea a los usuarios.
LOGIN_LOCKOUT_MAX_FAILURES=5
LOGIN_LOCKOUT_WINDOW_MINUTES=15
LOGIN_LOCKOUT_SYSTEM_MAX_FAILURES=20   # Umbral más alto para el usuario "sistema" (never permanent)
LOCKOUT_ALERT_CHANNEL=log              # Solo 'log' disponible por ahora; email/webhook son futuros
```

```bash
# Levantar todo
docker compose -f docker-compose.prod.yml up -d --build

# Verificar que está funcionando
docker compose -f docker-compose.prod.yml ps
curl http://localhost:3000/health   # Debe responder: {"status":"ok"}
```

La web estará en `http://localhost:8090` y la API en `http://localhost:3000`.

### Actualizar a una nueva versión

```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# Las migraciones se aplican automáticamente al reiniciar
```

### Ver logs

```bash
docker compose -f docker-compose.prod.yml logs -f api    # Logs de la API
docker compose -f docker-compose.prod.yml logs -f web    # Logs del frontend
```

### Parar el servicio

```bash
docker compose -f docker-compose.prod.yml down           # Para los contenedores (datos se conservan)
docker compose -f docker-compose.prod.yml down -v        # Para Y elimina la base de datos ⚠️
```

---

## 🧪 Probar la aplicación

### Tests automáticos

```bash
pnpm test        # API (jest) + web (vitest) — corre en el CI de cada PR
pnpm lint
pnpm typecheck
```

### Probar a mano (flujo clave)

Con `pnpm dev` levantado (+ DB, migraciones y seed, ver arriba), entrá con el admin y recorré:

1. Crear un producto → **vender** (probá efectivo y pago mixto Yape+Efectivo).
2. Ver que **Caja** y **Dashboard** se actualizan en el momento.
3. Registrar un **egreso** → ver que aparece en la lista y en la caja.
4. Exportar el **reporte Excel** y revisar totales.
5. **Anular** una venta → ver que se refleja.

### Pre-producción (probar el stack de producción localmente)

`docker-compose.prod.yml` construye los **Dockerfiles reales** (api + web + db) igual que en producción. Úsalo para validar antes de desplegar a Coolify:

```bash
docker compose -f docker-compose.prod.yml build --build-arg VITE_API_URL=http://localhost:3000
docker compose -f docker-compose.prod.yml up -d
# web → http://localhost:8090   ·   api → http://localhost:3000
curl http://localhost:3000/health      # {"status":"ok"}
```

Esto verifica que los Dockerfiles, las migraciones y el seed funcionan end-to-end.

---

## 🖥️ App de escritorio (Electron)

Es el **target real del modo offline**: la app **empaqueta la web adentro** y la
carga local, así abre y vende **con o sin internet**. Solo el **API** es remoto.

### Modo desarrollo

```bash
pnpm dev:web                  # frontend en localhost:5173
cd apps/desktop && pnpm dev   # Electron apuntando al dev server
```

### Construir el instalador (Windows)

```bash
pnpm --filter @app/desktop dist:win
# Hace: build de la web → build de Electron → copia la web adentro → electron-builder
# Genera el instalador .exe en  apps/desktop/release/
```

(Para Mac/Linux: usar `dist` en vez de `dist:win`, desde esa plataforma.)

### Primer arranque y configuración

1. Al abrir por primera vez pide la **URL del API** de la sucursal
   (ej. `https://api-polleria-tusucursal.groowtech.com`). Se guarda local; solo
   se hace una vez.
2. Entrá como admin → **Configuración → Acceso sin conexión (PIN)** → definí el
   PIN de 4 dígitos para vender offline.

### Probar el modo offline

1. Con internet: entrá y hacé una venta (se sincroniza al servidor).
2. Cortá el internet (desconectá el WiFi).
3. Cerrá y reabrí la app → **carga igual** (web local) y los **productos siguen
   apareciendo** (catálogo cacheado).
4. En el login aparece **"Ingresar sin conexión"** → poné el PIN → entrás como
   cajero → vendé e imprimí.
5. Reconectá → te pide login → al entrar, **sincroniza** las ventas encoladas.

> ⚠️ **Si el login _online_ falla en la app instalada**: es la cookie cross-origin
> (la app corre en `app://`, el API en `https://`). Poné `COOKIE_SAMESITE=none` en
> el API y permití el origen `app://` en el CORS. Ver `docs/GOTCHAS.md`.

---

## 🚀 Releases automáticos (auto-update del desktop)

Sí, GitHub ya hace los releases — y está armado de la forma **recomendada: por
tag, no en cada push.**

### Cómo se publica una versión

1. Subí la versión en `apps/desktop/package.json` (ej. `0.2.0`).
2. Tageá y empujá:
   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```
3. El workflow `.github/workflows/release.yml` (en `windows-latest`) construye el
   instalador y lo **publica en GitHub Releases** automáticamente.
4. Las apps ya instaladas se **auto-actualizan** (electron-updater chequea los
   releases de GitHub al abrir).

También se puede disparar a mano desde la pestaña **Actions** (workflow_dispatch).

### ¿Conviene automatizarlo del todo (release en cada push)?

**No, y por eso no se hizo así.** En un POS de escritorio no querés mandar un
instalador nuevo a las PCs en cada commit: sería ruido y arriesgás romper
producción con algo sin probar. El modelo correcto es el que está: **release
deliberado por tag**, versionado, que vos controlás cuándo. Lo "automático" es
todo lo que pasa _después_ del tag (build + publish + auto-update). Ese es el
equilibrio sano entre automatización y control.

---

## Estructura del proyecto

```
SistemaPolleriaPos/
├── apps/
│   ├── api/                        # Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/               # Login, JWT, cookies
│   │   │   ├── users/              # Usuarios y perfiles
│   │   │   ├── inventory/          # Productos y categorías
│   │   │   ├── sales/              # Ventas, pagos, anulaciones
│   │   │   ├── cash/               # Egresos, dashboard de caja
│   │   │   ├── settings/           # Configuración de la tienda
│   │   │   ├── database/
│   │   │   │   ├── migrations/     # Migraciones TypeORM
│   │   │   │   └── seeds/          # Datos iniciales
│   │   │   └── config/             # Validación de env vars (Zod)
│   │   ├── Dockerfile
│   │   └── docker-entrypoint.sh    # migration:run → seed → node dist/main.js
│   ├── web/                        # Frontend React
│   │   └── src/
│   │       ├── pages/              # Ventas, Caja, Egresos, Dashboard, Productos, etc.
│   │       ├── components/         # Componentes reutilizables
│   │       ├── hooks/              # TanStack Query hooks
│   │       ├── services/           # Llamadas a la API
│   │       ├── lib/                # Utilidades (formato, permisos, queue offline)
│   │       └── types/              # Tipos TypeScript
│   └── desktop/                    # Electron wrapper
│       └── electron/
│           ├── main.ts             # Ventana principal + IPC de impresión
│           └── preload.ts          # Bridge window.electronAPI
├── packages/
│   ├── contracts/                  # Schemas Zod compartidos API ↔ web
│   └── tsconfig/                   # Config TypeScript base compartida
├── docker-compose.yml              # PostgreSQL para desarrollo
├── docker-compose.prod.yml         # Stack completo para producción
└── .env.example                    # Plantilla de variables de entorno
```

---

## Roles de usuario

| Rol       | Acceso                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `Admin`   | Todo: ventas, egresos, caja, dashboard, productos, usuarios, configuración |
| `Cashier` | Solo ventas y egresos                                                      |

Los cajeros se crean desde la sección **Usuarios** con el rol Cashier.

---

## Funcionalidad offline

Si se cae la conexión a internet, el POS sigue funcionando:

- Las ventas y egresos se guardan localmente en el navegador (IndexedDB via Dexie)
- Un badge en el header muestra cuántos registros están pendientes de sincronizar
- Al recuperarse la conexión, se sincronizan automáticamente

---

## Preguntas frecuentes

**¿Puedo cambiar el nombre de la pollería?**
Sí, en la sección **Configuración** dentro de la app.

**¿Cómo reseteo la contraseña del admin?**
Edita la variable `ADMIN_PASSWORD` en `.env` y reinicia con `docker compose -f docker-compose.prod.yml up -d`. El seed es idempotente y actualizará la contraseña.

**¿Cómo agrego más métodos de pago?**
Desde **Configuración → Métodos de pago** dentro de la app.

**¿Dónde están los reportes?**
En **Caja → Reportes**. Se exportan como archivo Excel con el rango de fechas que elijas.

**La API dice "synchronize: false" ¿qué significa?**
Que el esquema de la base de datos NUNCA se modifica automáticamente. Cada cambio pasa por una migración explícita. Esto es intencional para evitar pérdida de datos en producción.

---

## Decisiones técnicas

- **bcryptjs** en vez de bcrypt nativo: sin compilación nativa, funciona en Alpine y CI sin problemas
- **Cookie httpOnly** para JWT: el frontend nunca toca el token, inmune a XSS
- **Auth por username** (no email): diseñado para uso interno en un POS, sin registro público
- **Contratos Zod compartidos**: misma validación en API (`ZodValidationPipe`) y frontend (`zodResolver`) — un solo lugar para cambiar el contrato
- **Sin `typeorm-naming-strategies`**: `name:` explícito en todos los `@Column` y `@JoinColumn` para columnas predecibles
- **pnpm 11 con corepack**: versión fijada en `packageManager` para que todos usen exactamente la misma
