#!/bin/sh
set -eu

echo "[docker-entrypoint] Starting runtime initialization..."
echo "[docker-entrypoint] Running as user: $(id -u):$(id -g)"
echo "[docker-entrypoint] Command to execute: $*"

if [ -d /data ]; then
  echo "[docker-entrypoint] Preparing /data volume..."
  mkdir -p /data/.openclaw /data/workspace
  chown -R node:node /data
  chmod 755 /data /data/.openclaw /data/workspace
  echo "[docker-entrypoint] /data permissions fixed"
  ls -ld /data /data/.openclaw /data/workspace || true
else
  echo "[docker-entrypoint] /data does not exist, skipping volume initialization"
fi

if [ -n "${NODE_OPTIONS:-}" ]; then
  export NODE_OPTIONS
  echo "[docker-entrypoint] NODE_OPTIONS detected: $NODE_OPTIONS"
else
  echo "[docker-entrypoint] NODE_OPTIONS not set"
fi

echo "[docker-entrypoint] Handing off to gosu..."

set +e
gosu node "$@"
status=$?

echo "[docker-entrypoint] OpenClaw process exited with code: $status"
echo "[docker-entrypoint] Sleeping for 600 seconds so the container stays alive for debugging..."
sleep 600

exit $status
