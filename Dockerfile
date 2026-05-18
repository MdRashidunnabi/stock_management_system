# ============================================================
#  ShopOS - Production Dockerfile
#  Multi-stage build for a minimal Next.js 16 standalone image.
#
#  Build: docker build -t shopos-app .
#  Run:   docker compose -f docker-compose.prod.yml up -d
# ============================================================

# ---- Stage 1: install dependencies -------------------------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

# ---- Stage 2: build the Next.js app ------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies from the previous stage.
COPY --from=deps /app/node_modules ./node_modules
# Copy everything else (source, configs, public assets).
COPY . .

# Build the production bundle.  The `standalone` output (set in
# next.config.ts) produces a self-contained /app/.next/standalone
# folder that does not need node_modules at runtime.
RUN npm run build

# ---- Stage 3: minimal production image ---------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy only what the standalone server needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# `server.js` is created by Next.js standalone output.
CMD ["node", "server.js"]
