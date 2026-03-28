#!/usr/bin/env sh
set -eu

log() {
  echo "[openclaw-entrypoint] $*"
}

DATA_DIR="/data"
OPENCLAW_DIR="$DATA_DIR/.openclaw"
WORKSPACE_DIR="$DATA_DIR/workspace"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

log "Starting runtime initialization..."
log "Running as user: $(id -u):$(id -g)"

if [ -n "${NODE_OPTIONS:-}" ]; then
  log "NODE_OPTIONS detected: $NODE_OPTIONS"
fi

mkdir -p "$OPENCLAW_DIR"
mkdir -p "$WORKSPACE_DIR"
mkdir -p "$OPENCLAW_DIR/agents/main/agent"

log "Preparing /data volume..."
chown -R node:node "$DATA_DIR" 2>/dev/null || true
log "/data permissions fixed"

ls -ld "$DATA_DIR" "$OPENCLAW_DIR" "$WORKSPACE_DIR" 2>/dev/null || true

node <<'NODE'
const fs = require('fs');

const path = '/data/.openclaw/openclaw.json';
const defaultAllowedOrigins = ['https://openclaw-production-aefb.up.railway.app'];

function writeJson(obj) {
  fs.mkdirSync('/data/.openclaw', { recursive: true });
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

function buildFallbackConfig() {
  return {
    agents: {
      defaults: {
        compaction: { mode: 'safeguard' },
        maxConcurrent: 4,
        subagents: { maxConcurrent: 8 },
        model: {
          primary: 'deepseek/deepseek-reasoner',
          fallbacks: ['deepseek/deepseek-chat']
        },
        models: {
          'deepseek/deepseek-reasoner': {},
          'deepseek/deepseek-chat': {}
        }
      }
    },
    messages: {
      ackReactionScope: 'group-mentions'
    },
    commands: {
      native: 'auto',
      nativeSkills: 'auto',
      restart: true,
      ownerDisplay: 'raw'
    },
    channels: {
      discord: {
        enabled: true,
        groupPolicy: 'allowlist',
        streaming: 'off'
      }
    },
    gateway: {
      controlUi: {
        allowedOrigins: defaultAllowedOrigins
      }
    },
    meta: {
      lastTouchedVersion: '2026.3.26',
      lastTouchedAt: new Date().toISOString()
    }
  };
}

try {
  let cfg;

  if (fs.existsSync(path)) {
    const raw = fs.readFileSync(path, 'utf8');
    cfg = JSON.parse(raw);
    console.log('[openclaw-entrypoint] Existing openclaw.json loaded');
  } else {
    cfg = buildFallbackConfig();
    console.log('[openclaw-entrypoint] openclaw.json missing, creating a new one');
  }

  if (cfg.slugGenerator) {
    delete cfg.slugGenerator;
    console.log('[openclaw-entrypoint] Removed unsupported slugGenerator key');
  }

  cfg.agents = cfg.agents || {};
  cfg.agents.defaults = cfg.agents.defaults || {};
  cfg.agents.defaults.compaction = cfg.agents.defaults.compaction || { mode: 'safeguard' };
  if (cfg.agents.defaults.maxConcurrent == null) cfg.agents.defaults.maxConcurrent = 4;
  cfg.agents.defaults.subagents = cfg.agents.defaults.subagents || {};
  if (cfg.agents.defaults.subagents.maxConcurrent == null) cfg.agents.defaults.subagents.maxConcurrent = 8;

  cfg.agents.defaults.model = {
    primary: 'deepseek/deepseek-reasoner',
    fallbacks: ['deepseek/deepseek-chat']
  };

  cfg.agents.defaults.models = {
    'deepseek/deepseek-reasoner': {},
    'deepseek/deepseek-chat': {}
  };

  cfg.messages = cfg.messages || {};
  if (!cfg.messages.ackReactionScope) cfg.messages.ackReactionScope = 'group-mentions';

  cfg.commands = cfg.commands || {};
  if (cfg.commands.native == null) cfg.commands.native = 'auto';
  if (cfg.commands.nativeSkills == null) cfg.commands.nativeSkills = 'auto';
  if (cfg.commands.restart == null) cfg.commands.restart = true;
  if (cfg.commands.ownerDisplay == null) cfg.commands.ownerDisplay = 'raw';

  cfg.channels = cfg.channels || {};
  cfg.channels.discord = cfg.channels.discord || {};
  if (cfg.channels.discord.enabled == null) cfg.channels.discord.enabled = true;
  if (!cfg.channels.discord.groupPolicy) cfg.channels.discord.groupPolicy = 'allowlist';
  if (!cfg.channels.discord.streaming) cfg.channels.discord.streaming = 'off';

  cfg.gateway = cfg.gateway || {};
  cfg.gateway.controlUi = cfg.gateway.controlUi || {};
  if (!Array.isArray(cfg.gateway.controlUi.allowedOrigins) || cfg.gateway.controlUi.allowedOrigins.length === 0) {
    cfg.gateway.controlUi.allowedOrigins = defaultAllowedOrigins;
  }

  cfg.meta = cfg.meta || {};
  cfg.meta.lastTouchedVersion = '2026.3.26';
  cfg.meta.lastTouchedAt = new Date().toISOString();

  writeJson(cfg);
  console.log('[openclaw-entrypoint] openclaw.json repaired and written successfully');
} catch (err) {
  console.log('[openclaw-entrypoint] Failed to parse existing openclaw.json, replacing it');
  console.log(String(err && err.message ? err.message : err));
  const fallback = buildFallbackConfig();
  writeJson(fallback);
  console.log('[openclaw-entrypoint] Fallback openclaw.json written successfully');
}
NODE

if [ "$#" -eq 0 ]; then
  set -- node openclaw.mjs gateway --allow-unconfigured --bind lan --port 8080
fi

log "Command to execute: $*"
exec "$@"
