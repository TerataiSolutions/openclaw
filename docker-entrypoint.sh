#!/bin/sh
set -eu

if [ -d /data ]; then
  echo "[docker-entrypoint] Fixing /data directory permissions for node user..."
  mkdir -p /data/.openclaw /data/workspace
  chown -R node:node /data
  chmod 755 /data /data/.openclaw /data/workspace
  echo "[docker-entrypoint] Permissions fixed successfully"
fi

exec gosu node "$@"
