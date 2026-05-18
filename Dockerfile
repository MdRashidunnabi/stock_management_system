# ============================================================
#  ShopOS - Production Dockerfile
#  Multi-stage build for a minimal Next.js 16 standalone image.
#
#  NEXT_PUBLIC_* vars must be passed as build args because
#  Next.js bakes them into the client bundle at build time.
#
#  Build (standalone):
#    docker compose -f docker-compose.docker-local.yml up --build
#  Or manually:
#    docker build \
#      --build-arg NEXT_PUBLIC_SUPABASE_URL=https://... \
#      --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#      --build-arg NEXT_PUBLIC_APP_URL=https://yourdomain.ie \
#      -t shopos-app .
# ============================================================

# ---- Stage 1: install dependencies -------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install all deps (including devDeps needed for the build step).
RUN npm ci

# ---- Stage 2: build the Next.js app ------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Declare build-time env vars.  These are NEXT_PUBLIC_* only - they
# get baked into the client bundle.  Server-only secrets stay in the
# runtime env file and are never embedded in the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_DEFAULT_LOCALE=en-IE
ARG NEXT_PUBLIC_DEFAULT_CURRENCY=EUR
ARG NEXT_PUBLIC_DEFAULT_TIMEZONE=Europe/Dublin
ARG NEXT_PUBLIC_DEFAULT_COUNTRY=IE

# Make them visible as ENV so Next.js picks them up during build.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE
ENV NEXT_PUBLIC_DEFAULT_CURRENCY=$NEXT_PUBLIC_DEFAULT_CURRENCY
ENV NEXT_PUBLIC_DEFAULT_TIMEZONE=$NEXT_PUBLIC_DEFAULT_TIMEZONE
ENV NEXT_PUBLIC_DEFAULT_COUNTRY=$NEXT_PUBLIC_DEFAULT_COUNTRY

# Dummy server-side vars so the build doesn't crash when importing
# server modules that reference env.  These are never used at runtime.
ENV SUPABASE_SERVICE_ROLE_KEY=build-time-placeholder-not-used
ENV DATABASE_URL=postgresql://build:time@localhost:5432/placeholder
ENV AUTH_SECRET=build-time-placeholder-secret-32-chars!

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- Stage 3: minimal production runner --------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone output: only copy what the server needs to run.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
