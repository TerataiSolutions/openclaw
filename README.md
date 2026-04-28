# Aether — Personal AI Assistant Bot

Aether is a custom OpenClaw-based bot that manages memories, analyzes campaigns, and automates daily operations across Discord.

## Quick Start (5 minutes)

### Prerequisites
- Node.js 22+
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COHERE_API_KEY`, `DISCORD_BOT_TOKEN`

### Install and Run
```bash
cd /data/.openclaw/workspace
NODE_ENV=development npm install
npm test  # Verify all systems healthy
```

### First Change: Add a Cron Job

1. Create `cron/my_job.js`:
```javascript
const { sendDiscordAlert } = require('../lib/clients/discord');

async function runMyJob() {
  console.log('My job is running');
  await sendDiscordAlert('My job completed');
}

runMyJob().catch(err => {
  console.error('Job failed:', err.message);
  sendDiscordAlert(`❌ My job failed: ${err.message}`);
});
```

2. Schedule it in `cron/index.js`:
```javascript
cron.schedule('0 10 * * *', () => {
  runJob('my_job', '/data/.openclaw/workspace/cron/my_job.js');
});
```

3. Test:
```bash
node /data/.openclaw/workspace/cron/my_job.js
npm test
```

## Architecture

- **cron/** — Scheduled jobs (18+ files), run by `start_cron.js` via `cron/index.js`
- **lib/clients/** — External service abstractions (`supabase.js`, `discord.js`, `cohere.js`)
- **scripts/** — One-time and batch operations
- **test/** — Jest test suite (19 tests, 4 suites)
- **security/** — Input sanitization, audit logging
- **memory/** — Durable memory dumps (pre-compaction archives)

## Key Files

| File | Purpose |
|------|---------|
| `cron/index.js` | Cron schedule definitions (~25 schedules) |
| `cron/start_cron.js` | Cron manager launcher with PID lock + zombie detection |
| `cron/message_queue.js` | Persistent message retry queue (JSONL) |
| `cron/dependency_healthcheck.js` | API health checks every 5 minutes |
| `lib/clients/supabase.js` | Singleton Supabase client (service role) |
| `lib/clients/discord.js` | Discord API wrapper (via message bridge) |
| `lib/clients/cohere.js` | Cohere embedding generation |

## Common Tasks

- **Debug a failed cron job** → `docs/debugging-cron-jobs.md`
- **Rotate credentials** → `RUNBOOK_CREDENTIAL_ROTATION.md`
- **Add a new memory type** → Add validation in `security/input_sanitizer.js`, then test with `npm test`

## Testing

```bash
npm test                           # Run all 19 unit tests
npm test -- --watch                # Watch mode during development
npm test -- --coverage             # Coverage report
```

## Deployment

Changes to cron jobs take effect on the next scheduled run. For immediate testing:
```bash
node /data/.openclaw/workspace/cron/job_name.js
```

Critical changes require:
1. Write test case in `test/` directory
2. Run `npm test` to verify
3. Commit and push (Railway auto-deploys on git push)

## Memory System

Aether includes automated memory backup, integrity checking, and recovery:

- Daily backup at 2 AM ET (`cron/memory_backup.js`)
- Auto-recovery at 3 AM ET (`cron/auto_recover.js`)
- Integrity check at 8 AM ET (`cron/memory_integrity_check.js`)
- Semantic search via `scripts/semantic_search_enhanced.js`
- Fallback RPC + client-side cosine similarity
