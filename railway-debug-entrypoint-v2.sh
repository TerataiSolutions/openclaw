#!/bin/sh
set -eu

LOG_FILE=/tmp/openclaw-startup.log

echo "[railway-debug-entrypoint-v2] VERSION MARKER: ENTRYPOINT_V2_20260328"
echo "[railway-debug-entrypoint-v2] COMMIT CHECK MARKER 20260328A"
echo "[railway-debug-entrypoint-v2] Starting runtime initialization..."
echo "[railway-debug-entrypoint-v2] Running as user: $(id -u):$(id -g)"
echo "[railway-debug-entrypoint-v2] Command to execute: $*"

echo "[railway-debug-entrypoint-v2] Preparing /data volume..."
mkdir -p /data /data/.openclaw /data/workspace
chown -R node:node /data

echo "[railway-debug-entrypoint-v2] /data permissions fixed"
ls -ld /data /data/.openclaw /data/workspace || true

if [ -n "${NODE_OPTIONS:-}" ]; then
  echo "[railway-debug-entrypoint-v2] NODE_OPTIONS detected: ${NODE_OPTIONS}"
fi

echo "[railway-debug-entrypoint-v2] Capturing OpenClaw output to ${LOG_FILE}"
set +e
gosu node "$@" >"${LOG_FILE}" 2>&1
code=$?
set -e

echo "[railway-debug-entrypoint-v2] OpenClaw process exited with code: ${code}"
echo "[railway-debug-entrypoint-v2] ===== BEGIN CAPTURED OPENCLAW LOG ====="
cat "${LOG_FILE}" || true
echo "[railway-debug-entrypoint-v2] ===== END CAPTURED OPENCLAW LOG ====="

echo "[railway-debug-entrypoint-v2] Sleeping for 600 seconds so the container stays alive for debugging..."
sleep 600

exit "${code}"
