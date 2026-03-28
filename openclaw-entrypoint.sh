#!/bin/sh
set -eu

echo "[openclaw-entrypoint] Starting runtime initialization..."
echo "[openclaw-entrypoint] Running as user: $(id -u):$(id -g)"
echo "[openclaw-entrypoint] Command to execute: $*"

echo "[openclaw-entrypoint] Preparing /data volume..."
mkdir -p /data /data/.openclaw /data/workspace
chown -R node:node /data

echo "[openclaw-entrypoint] /data permissions fixed"
ls -ld /data /data/.openclaw /data/workspace || true

if [ -n "${NODE_OPTIONS:-}" ]; then
  echo "[openclaw-entrypoint] NODE_OPTIONS detected: ${NODE_OPTIONS}"
fi

echo "[openclaw-entrypoint] Checking Control UI dist..."
if [ -d /app/dist/control-ui ]; then
  echo "[openclaw-entrypoint] /app/dist/control-ui exists"
  ls -la /app/dist/control-ui || true
else
  echo "[openclaw-entrypoint] /app/dist/control-ui is missing"
fi

if [ -f /app/dist/control-ui/index.html ]; then
  echo "[openclaw-entrypoint] /app/dist/control-ui/index.html exists"
else
  echo "[openclaw-entrypoint] /app/dist/control-ui/index.html is missing"
fi

exec gosu node "$@"
