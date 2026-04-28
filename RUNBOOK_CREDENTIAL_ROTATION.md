# Credential Rotation

## Discord Bot Token

1. Generate new token in Discord Developer Portal
2. Update in Railway:
```bash
DISCORD_BOT_TOKEN=new_token_here
```
3. Restart Aether (optional — takes effect on next health check):
```bash
# Railway restart triggers this. Or wait for auto-repair at 8:15 AM ET
```
4. Verify in cron logs:
```bash
grep "Discord" /data/.openclaw/workspace/cron/cron.log | tail -3
```

## Supabase API Key

1. Rotate in Supabase dashboard (Settings → API)
2. Update Railway:
```bash
SUPABASE_SERVICE_ROLE_KEY=new_key_here
```
3. Aether will use new key on next API call (no restart needed)
4. Verify:
```bash
node -e "const {getSupabaseClient} = require('./lib/clients/supabase.js'); console.log('✅ New key accepted')"
```

## Cohere API Key

1. Rotate in Cohere account settings
2. Update Railway:
```bash
COHERE_API_KEY=new_key_here
```
3. Verify:
```bash
node /data/.openclaw/workspace/cron/dependency_healthcheck.js | grep -i cohere
```

## Post-Rotation Verification

Run this 5 minutes after updating any credential:
```bash
npm test 2>&1 | grep -E "passed|failed"
grep -i "credential" /data/.openclaw/workspace/logs/audit.log | tail -3
```
