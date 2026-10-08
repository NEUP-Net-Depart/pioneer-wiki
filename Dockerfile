# syntax=docker/dockerfile:1

# Production image for Pioneer Wiki. Three stages share one build:
#
#   deps    -> pnpm install --frozen-lockfile against the committed lockfile
#   builder -> `next build` with NEXT_STANDALONE=true, which emits the
#              self-contained server in `.next/standalone` (see next.config.ts)
#   runner  -> the standalone server, no package installation, non-root
#
# `tools` is the builder plus a shell, for the one-off seed and admin-bootstrap
# commands that need the Supabase service-role key.
#
# Supabase settings are read from the environment at request time, not inlined
# by the build, so one image runs against mock fixtures or any Supabase project.
# That holds while no client component reads the Supabase env; if one ever does,
# the URL and anon key must become build arguments instead.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM deps AS builder
WORKDIR /app
# Deterministic and network-free, matching CI: every route is rendered on demand,
# so nothing is prerendered from a data source at build time. NEXT_STANDALONE
# switches the output to the self-contained server copied into the runner below.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_STANDALONE=true \
    PIONEER_DATA_SOURCE=mock
COPY . .
RUN pnpm run build

# One-off tooling: `pnpm run seed-supabase`, `pnpm run bootstrap-admin`.
FROM builder AS tools

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# .next/standalone carries server.js, the traced server dependencies (including
# sharp) and the traced src/mock/bodies fixtures. It deliberately does not carry
# the browser-served build output or public/, so both are added here. Without
# .next/static every /_next/static/** request — the JS chunks, the CSS and the
# next/font files — 404s, while /icon.svg still answers and the healthcheck
# stays green.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The image optimizer caches re-encoded files under .next/cache at request time
# and member uploads land in .data/uploads when Supabase Storage is not in use.
# Both are copied in as root, so hand them to the unprivileged user.
RUN mkdir -p /app/.next/cache /app/.data/uploads \
    && chown -R node:node /app/.next/cache /app/.data

USER node
EXPOSE 3000
# /icon.svg lives in public/, so it answers even when the build output above was
# never packaged: check for .next/static too, or a broken image reports healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const fs=require('fs');fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok&&fs.existsSync('.next/static')?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
