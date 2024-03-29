# syntax=docker/dockerfile:1

FROM node:16.14.2 AS base
WORKDIR /root/monorepo

COPY . .
RUN npm --global install pnpm

# Installing all dependencies and building the packages
FROM base AS dev

RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store pnpm install --frozen-lockfile

# ↑ Using `--invert-match` to discard annoying output

# Resetting back to no dependencies installed, and deleting all source folders because we don't need source files. This way whatever files are built are left behind.
FROM dev AS assets
RUN rm -rf node_modules && pnpm recursive exec -- rm -rf ./node_modules ./src

# Only installing production dependencies
FROM base as prod
ENV NODE_ENV=production

# Copy the built files
COPY --from=assets /root/monorepo .

RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store pnpm install --prod --frozen-lockfile

CMD ["node", "packages/discord-email-tunnel/dist/bin/start.js"]
