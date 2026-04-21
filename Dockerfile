FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Real-ESRGAN (ncnn-vulkan) needs the Vulkan loader present to start.
RUN apt-get update && apt-get install -y --no-install-recommends libvulkan1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
