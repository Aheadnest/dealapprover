# ---------------------------------------------------
# 1. Base: install all deps (prod + dev)
# ---------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install

# ---------------------------------------------------
# 2. Builder: compile TypeScript
# ---------------------------------------------------
FROM base AS builder
COPY . .
RUN npm run build

# ---------------------------------------------------
# 3. Production: lean image with prod deps only
# ---------------------------------------------------
FROM node:22-alpine AS prod
WORKDIR /app

# sharp needs platform-native binaries
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV PORT=3005
EXPOSE ${PORT}
CMD ["node", "dist/server.js"]
