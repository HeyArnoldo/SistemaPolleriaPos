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

| Variable          | Descripción                            | Ejemplo                     |
| ----------------- | -------------------------------------- | --------------------------- |
| `DB_HOST`         | Host de PostgreSQL                     | `localhost`                 |
| `DB_PORT`         | Puerto de PostgreSQL                   | `5432`                      |
| `DB_USER`         | Usuario de la base de datos            | `app`                       |
| `DB_PASSWORD`     | Contraseña de la base de datos         | `app`                       |
| `DB_NAME`         | Nombre de la base de datos             | `sistema_polleria_pos`      |
| `JWT_SECRET`      | Clave secreta para JWT (mín. 32 chars) | `openssl rand -base64 32`   |
| `JWT_EXPIRES_IN`  | Duración de la sesión                  | `7d`                        |
| `CORS_ORIGIN`     | URL del frontend (en producción)       | `https://pos.tudominio.com` |
| `FRONTEND_URL`    | Igual que CORS_ORIGIN                  | `https://pos.tudominio.com` |
| `ADMIN_USERNAME`  | Usuario del admin inicial              | `admin`                     |
| `ADMIN_PASSWORD`  | Contraseña del admin inicial           | `Admin1234!`                |
| `COOKIE_SECURE`   | `true` en producción, `false` en local | `true`                      |
| `COOKIE_SAMESITE` | `lax` para dominios iguales            | `lax`                       |
| `BCRYPT_ROUNDS`   | Rondas de hash (12 es suficiente)      | `12`                        |

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

## App de escritorio (Electron)

La app de escritorio envuelve el frontend web y permite imprimir tickets sin diálogo de impresión.

### Modo desarrollo

```bash
# Primero levanta el frontend web
pnpm dev:web

# En otra terminal, levanta Electron
cd apps/desktop
pnpm dev   # Abre una ventana apuntando a http://localhost:5173
```

### Configurar la URL del backend

La variable `WEB_URL` en `apps/desktop/electron/main.ts` controla a qué frontend apunta la app. Por defecto: `http://localhost:8090` (el docker-compose.prod.yml).

Para producción, edita esa línea antes de compilar:

```typescript
const WEB_URL = process.env.WEB_URL ?? 'https://pos.tudominio.com';
```

### Compilar el instalador

```bash
cd apps/desktop
pnpm build   # Genera los archivos en dist-electron/
```

> Para generar instaladores `.exe` (Windows) o `.dmg` (Mac) se necesita `electron-builder`. Ver la sección de empaquetado más abajo.

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
