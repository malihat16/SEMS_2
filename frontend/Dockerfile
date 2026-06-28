# Use Debian slim (includes glibc). Alpine lacks glibc and some native deps expect it.
FROM node:lts-bookworm-slim AS builder
WORKDIR /app

# Copy only manifests first for better caching
COPY package.json yarn.lock .yarnrc.yml ./

RUN corepack enable
RUN yarn install --immutable

# Build-time args for SvelteKit's $env/static/public (baked at build time)
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY

# Now copy the rest and build
COPY . .
RUN yarn build

FROM node:lts-bookworm-slim
WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/.yarnrc.yml ./
COPY --from=builder /app/src/lib/email/templates ./src/lib/email/templates

RUN corepack enable
# Single-package, nodeLinker: node-modules — install prod deps only
RUN yarn workspaces focus --production

EXPOSE 3000

# PROTOCOL_HEADER and HOST_HEADER can be used by the app to determine the original protocol and host when behind a proxy
# See: https://svelte.dev/docs/kit/adapter-node#Environment-variables-ORIGIN-PROTOCOL_HEADER-HOST_HEADER-and-PORT_HEADER
ENV NODE_ENV=production \
  PROTOCOL_HEADER=x-forwarded-proto \
  HOST_HEADER=x-forwarded-host

CMD ["node", "build"]

# Healthcheck to provide information used for example in `docker ps`
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3000',{method:'HEAD'},r=>process.exit((r.statusCode>=200&&r.statusCode<400)?0:1)).on('error',()=>process.exit(1)).end()"
