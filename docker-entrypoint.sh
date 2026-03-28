#!/bin/sh
set -eu

LOG_FILE=/tmp/openclaw-startup.log

echo "[docker-entrypoint] Starting runtime initialization..."
echo "[docker-entrypoint] Running as user: $(id -u):$(id -g)"
echo "[docker-entrypoint] Command to execute: $*"

echo "[docker-entrypoint] Preparing /data volume..."
mkdir -p /data /data/.openclaw /data/workspace
chown -R node:node /data

echo "[docker-entrypoint] /data permissions fixed"
ls -ld /data /data/.openclaw /data/workspace || true

if [ -n "${NODE_OPTIONS:-}" ]; then
  echo "[docker-entrypoint] NODE_OPTIONS detected: ${NODE_OPTIONS}"
fi

echo "[docker-entrypoint] Capturing OpenClaw output to ${LOG_FILE}"
set +e
gosu node "$@" >"${LOG_FILE}" 2>&1
code=$?
set -e

echo "[docker-entrypoint] OpenClaw process exited with code: ${code}"
echo "[docker-entrypoint] ===== BEGIN CAPTURED OPENCLAW LOG ====="
cat "${LOG_FILE}" || true
echo "[docker-entrypoint] ===== END CAPTURED OPENCLAW LOG ====="

echo "[docker-entrypoint] Sleeping for 600 seconds so the container stays alive for debugging..."
sleep 600

exit "${code}"
