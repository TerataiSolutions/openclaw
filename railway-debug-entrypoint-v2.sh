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

exec gosu node "$@"
