FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/shared/OpenClawKit/Tools/CanvasA2UI ./apps/shared/OpenClawKit/Tools/CanvasA2UI
COPY apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json ./apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json
COPY vendor/a2ui/renderers/lit ./vendor/a2ui/renderers/lit

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production

COPY openclaw-entrypoint.sh /usr/local/bin/openclaw-entrypoint.sh
RUN chmod +x /usr/local/bin/openclaw-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/openclaw-entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured", "--bind", "lan", "--port", "8080"]
