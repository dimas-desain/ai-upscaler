# STAGE 1: Install dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Sharp butuh build tools kalo binary pre-built-nya ga cocok, tapi biasanya aman
RUN npm install --legacy-peer-deps

# STAGE 2: Build the app
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# STAGE 3: Final Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Sharp di Linux butuh library dasar ini
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    libvips \
    && rm -rf /var/lib/apt/lists/*

# Copy hasil build
COPY --from=build /app/.next ./.next
# Wildcard ? biar ga error kalo folder public lo kosong/ga ada di repo
COPY --from=build /app/public? ./public/
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

# Opsional: Folder tmp kalo lo masih mau nyimpen cache gambar
RUN mkdir -p /app/.tmp && chmod 777 /app/.tmp

EXPOSE 3000
CMD ["npm", "start"]
