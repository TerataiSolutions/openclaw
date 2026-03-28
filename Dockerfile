FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

COPY railway-debug-entrypoint-v2.sh /usr/local/bin/railway-debug-entrypoint-v2.sh
RUN chmod +x /usr/local/bin/railway-debug-entrypoint-v2.sh

ENTRYPOINT ["/usr/local/bin/railway-debug-entrypoint-v2.sh"]
CMD ["node", "openclaw.mjs", "gateway", "--allow-unconfigured"]
