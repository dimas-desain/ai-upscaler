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

# ... (bagian atas tetap sama)

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget unzip libglib2.0-0 libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Download & Force path ke /app/realesrgan-ncnn-vulkan
RUN wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip \
    && unzip realesrgan-ncnn-vulkan-20220424-ubuntu.zip \
    && mv realesrgan-ncnn-vulkan-20220424-ubuntu/realesrgan-ncnn-vulkan /app/realesrgan-ncnn-vulkan \
    && mv realesrgan-ncnn-vulkan-20220424-ubuntu/models /app/models \
    && chmod +x /app/realesrgan-ncnn-vulkan \
    && rm -rf realesrgan-ncnn-vulkan-20220424-ubuntu.zip realesrgan-ncnn-vulkan-20220424-ubuntu

# ... (lanjutkan copy .next, node_modules, dll)