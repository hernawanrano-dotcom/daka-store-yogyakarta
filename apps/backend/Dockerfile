# Development stage
FROM node:20-alpine AS development
WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/*/package.json ./packages/

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Expose port
EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]

# Production build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=development /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/main.js"]