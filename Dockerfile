# ---------- Builder ----------
FROM mcr.microsoft.com/playwright:v1.43.0-jammy AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---------- Runner ----------
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ✅ install browser HERE (correct)
RUN npx playwright install chromium

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm start"]
