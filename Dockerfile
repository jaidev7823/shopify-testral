# ---------- Builder ----------
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npx playwright install chromium

# Build and VERIFY output
RUN npm run build && ls -R build

# ---------- Runner ----------
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
  openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Copy app files
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Prisma engine
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Playwright browsers
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

EXPOSE 3000

# TEMP: auto-detect correct entry (prevents crash)
CMD ["sh", "-c", "npx prisma db push && npm start"]
