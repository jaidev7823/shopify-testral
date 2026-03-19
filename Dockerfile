# ---------- Builder ----------
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

# Install only deps needed for build
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npx playwright install chromium
RUN npm run build

# ---------- Runner ----------
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Only minimal runtime deps
RUN apt-get update && apt-get install -y \
  openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install ONLY production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Playwright browsers ONLY (no reinstall)
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node build/index.js"]
