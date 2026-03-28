#!/bin/sh
set -eu

echo "[docker-entrypoint] Starting runtime initialization..."

if [ -d /data ]; then
  echo "[docker-entrypoint] Preparing /data volume..."
  mkdir -p /data/.openclaw /data/workspace
  chown -R node:node /data
  chmod 755 /data /data/.openclaw /data/workspace
  echo "[docker-entrypoint] /data permissions fixed"
else
  echo "[docker-entrypoint] /data does not exist, skipping volume initialization"
fi

if [ -n "${NODE_OPTIONS:-}" ]; then
  export NODE_OPTIONS
  echo "[docker-entrypoint] NODE_OPTIONS detected: $NODE_OPTIONS"
else
  echo "[docker-entrypoint] NODE_OPTIONS not set"
fi

exec gosu node "$@"
