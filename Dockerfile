# STAGE 1: Install dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
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

# 1. Install sistem dependencies (Lengkap untuk AI Engine)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvulkan1 \
    ca-certificates \
    wget \
    unzip \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup AI Engine (Real-ESRGAN)
RUN wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip \
    && unzip realesrgan-ncnn-vulkan-20220424-ubuntu.zip \
    && chmod +x realesrgan-ncnn-vulkan \
    && rm realesrgan-ncnn-vulkan-20220424-ubuntu.zip

# 3. Copy hasil build
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

# 4. Buat folder temporary untuk proses gambar
RUN mkdir -p /app/.tmp && chmod 777 /app/.tmp

EXPOSE 3000
CMD ["npm", "start"]
