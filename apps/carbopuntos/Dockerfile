# Construir desde la RAÍZ del repo (necesita el workspace completo):
#   docker build -f apps/carbopuntos/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
# Evita que el script "prepare" (husky) corra dentro del contenedor.
ENV HUSKY=0

# ── Stage 1: build ────────────────────────────────────────────────
FROM base AS build
# Solo manifests primero: la capa de install se cachea entre builds.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/carbopuntos-contracts/package.json packages/carbopuntos-contracts/
COPY apps/carbopuntos/package.json apps/carbopuntos/
RUN pnpm install --frozen-lockfile --filter @app/carbopuntos...

COPY packages/tsconfig packages/tsconfig
COPY packages/carbopuntos-contracts packages/carbopuntos-contracts
COPY apps/carbopuntos apps/carbopuntos
RUN pnpm --filter @app/carbopuntos-contracts build && pnpm --filter @app/carbopuntos build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

# Reinstala solo deps de producción preservando el layout del workspace.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/carbopuntos-contracts/package.json packages/carbopuntos-contracts/
COPY apps/carbopuntos/package.json apps/carbopuntos/
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @app/carbopuntos...

COPY --from=build /repo/packages/carbopuntos-contracts/dist packages/carbopuntos-contracts/dist
COPY --from=build /repo/apps/carbopuntos/dist apps/carbopuntos/dist
COPY apps/carbopuntos/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3100/health >/dev/null 2>&1 || exit 1

# Migraciones + seed SIEMPRE corren antes de levantar el hub.
ENTRYPOINT ["./docker-entrypoint.sh"]
