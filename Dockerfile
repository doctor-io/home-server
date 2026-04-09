# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server-only/package.json packages/server-only/
RUN npm ci --ignore-scripts

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy values so Next.js build doesn't fail on env validation
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV AUTH_SESSION_SECRET=placeholder-build-secret-32-chars-min

RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 homeio && \
    adduser --system --uid 1001 homeio

# Next.js standalone output
COPY --from=builder --chown=homeio:homeio /app/.next/standalone ./
COPY --from=builder --chown=homeio:homeio /app/.next/static ./.next/static
COPY --from=builder --chown=homeio:homeio /app/public ./public

# Server-side compiled output
COPY --from=builder --chown=homeio:homeio /app/dist-server ./dist-server

# dbus-helper sidecar
COPY --from=builder --chown=homeio:homeio /app/services/dbus-helper ./services/dbus-helper

# Migration files
COPY --from=builder --chown=homeio:homeio /app/drizzle ./drizzle

USER homeio

EXPOSE 12026

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:12026/api/health || exit 1

CMD ["node", "server.js"]
