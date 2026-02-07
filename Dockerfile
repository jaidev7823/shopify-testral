# ---------- Builder ----------
FROM node:20-bookworm-slim AS builder

# System deps: OpenSSL + Playwright browser deps
RUN apt-get update -y && apt-get install -y \
  openssl ca-certificates \
  libglib2.0-0 \
  fonts-liberation \
  libnss3 libatk-bridge2.0-0 libatk1.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
  libx11-6 libx11-xcb1 libxcb1 libxext6 libxi6 \
  libxrender1 libxtst6 libgtk-3-0 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client (ABI now deterministic)
RUN npx prisma generate

# Install Playwright browsers + deps (official way)
RUN npx playwright install --with-deps chromium

RUN npm run build

# ---------- Runner ----------
FROM node:20-bookworm-slim

# Runtime needs OpenSSL too (Prisma discussion fix)
RUN apt-get update -y && apt-get install -y \
  openssl ca-certificates \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*


WORKDIR /app
ENV NODE_ENV=production

RUN npx playwright install --with-deps chromium

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

EXPOSE 3000

CMD npx prisma migrate deploy && npm run start
