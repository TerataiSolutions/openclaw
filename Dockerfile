FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

ENV NODE_ENV=production

COPY railway-debug-entrypoint-v2.sh /usr/local/bin/railway-debug-entrypoint-v2.sh
RUN chmod +x /usr/local/bin/railway-debug-entrypoint-v2.sh

ENTRYPOINT ["/usr/local/bin/railway-debug-entrypoint-v2.sh"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured", "--bind", "lan", "--port", "8080"]
