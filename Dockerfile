# --- STEP 1: The Builder (Building the house) ---
FROM node:20-slim AS builder

# We need openssl for Prisma to work
RUN apt-get update && apt-get install -y openssl sqlite3

WORKDIR /app

# Copy the "instruction manuals" (package files)
COPY package*.json ./
RUN npm install

# Copy all your code
COPY . .

# Tell Prisma to prepare itself
RUN npx prisma generate

# Build the Remix / React Router app
RUN npm run build

# --- STEP 2: The Runner (Actually living in the house) ---
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y openssl sqlite3

WORKDIR /app

# Set the environment to Production
ENV NODE_ENV=production

# Copy only what we need from the builder (keeps the backpack light)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# MAGIC PART: Create the folder where the Magic Hard Drive (EFS) will plug in
RUN mkdir -p /mnt/data

# Tell the app where the database file is
ENV DATABASE_URL="file:/mnt/data/dev.db"

# Open the door (Port 3000)
EXPOSE 3000

# The command to start. 
# It runs migrations first to make sure the DB matches your code!
CMD npx prisma migrate deploy && npm run start