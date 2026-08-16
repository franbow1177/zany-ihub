FROM oven/bun:1.3.11

WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/zero/package.json ./packages/zero/
COPY services/api/package.json ./services/api/

RUN bun install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY services ./services

ENV NODE_ENV=development
