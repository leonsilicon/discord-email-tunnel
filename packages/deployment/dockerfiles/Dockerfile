# syntax=docker/dockerfile:1

FROM node:16.14.2 AS base
WORKDIR /root/monorepo

COPY . .
RUN npm --global install pnpm

# Installing all dependencies and building the packages
FROM base AS dev

RUN pnpm install

# By caching the content-addressable store we stop
# downloading the same dependencies again and again.
# Unfortunately, doing this causes Docker to place
# the pnpm content-addressable store on a different
# virtual drive, which prohibits pnpm from
# symlinking its content to its virtual store,
# and that causes pnpm to fall back on copying the
# files, and… that's totally fine! Except pnpm emits
# many warnings that its not using symlinks, so
# we also must use `grep` to filter out those warnings.
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store pnpm install --frozen-lockfile\
 | grep --invert-match "cross-device link not permitted\|Falling back to copying packages from store"
# ↑ Using `--invert-match` to discard annoying output

# Resetting back to no dependencies installed, and deleting all source folders because we don't need source files. This way whatever files are built are left behind.
FROM dev AS assets
RUN rm -rf node_modules && pnpm recursive exec -- rm -rf ./node_modules ./src

# Only installing production dependencies
FROM base as prod
RUN pnpm install --prod

COPY --from=assets /root/monorepo .

COPY ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "./"]
COPY ["packages/discord-email-tunnel", "./packages/discord-email-tunnel"]

# We have to run `pnpm install`
RUN pnpm install

CMD ["node", "packages/discord-email-tunnel/dist/bin/start.js"]
