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
RUN pnpm ui:build
RUN test -f /app/dist/control-ui/index.html

ENV NODE_ENV=production

COPY openclaw-entrypoint.sh /usr/local/bin/openclaw-entrypoint.sh
RUN chmod +x /usr/local/bin/openclaw-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/openclaw-entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured", "--bind", "lan", "--port", "8080"]
