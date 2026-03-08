# Dockerfile — Hisobchi Backend
# Multi-stage build: kichik, xavfsiz production image

# ─────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && cp -r node_modules /tmp/prod_modules
RUN npm ci

# ─────────────────────────────────────────
# Stage 2: Build
# ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate
RUN npx prisma generate

# TypeScript build
RUN npm run build

# ─────────────────────────────────────────
# Stage 3: Production
# ─────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Xavfsizlik: root bo'lmagan foydalanuvchi
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Faqat kerakli fayllar
COPY --from=deps /tmp/prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY package*.json ./

# Logs papkasi
RUN mkdir -p logs && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

# Migration + ishga tushirish
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
