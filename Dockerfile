FROM node:20-bookworm-slim AS base
WORKDIR /app

# Stage 1: Install deps
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Stage 2: Build app
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Library Sharp butuh beberapa library sistem dasar
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
