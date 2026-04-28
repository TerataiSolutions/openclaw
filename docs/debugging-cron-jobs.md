# Debugging a Failed Cron Job

## Quick Diagnosis (< 2 minutes)

1. Check if Aether posted a Discord alert about the failure
2. Check the job's most recent log:
````bash
   tail -50 /data/.openclaw/workspace/cron/cron.log | grep -i "job_name"
````
3. Check the error log:
````bash
   tail -20 /data/.openclaw/workspace/logs/errors.log
````

## Common Failures

### "Cron job timed out"
- The job ran but didn't complete in time
- Check if it's a blocking job (execSync) that ran during another job
- Solution: Increase timeout or reschedule

### "Supabase connection failed"
- Dependency health check should have alerted 5 minutes after failure
- Verify Supabase is online:
````bash
  curl -s https://api.supabase.co/health
````
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Railway env

### "Cohere API error"
- Check COHERE_API_KEY is set
- Check Cohere status: https://status.cohere.ai/
- Verify no rate limiting:
````bash
  grep -i "cohere" /data/.openclaw/workspace/logs/errors.log | tail -5
````

### "Discord message send failed"
- Check DISCORD_BOT_TOKEN is set
- Verify bot has permissions in the target channel
- Check message_queue.jsonl for queued messages:
````bash
  wc -l /data/.openclaw/workspace/message_queue.jsonl
````
- Queue will retry every 30 seconds for up to 3 attempts

## Manual Intervention

### Restart a specific cron job
````bash
node /data/.openclaw/workspace/cron/job_name.js
````

### Clear the message queue (WARNING: messages will be lost)
````bash
rm /data/.openclaw/workspace/message_queue.jsonl
````

### Force a dependency health check
````bash
node /data/.openclaw/workspace/cron/dependency_healthcheck.js
````

### View all scheduled cron jobs and next execution times
````bash
grep -E "cron.schedule\(" /data/.openclaw/workspace/cron/index.js | head -20
````

## Escalation

If a job repeatedly fails and you cannot identify the cause:
1. Check the git log for recent changes to that job
2. Roll back the change and redeploy
3. Run tests to verify the rollback didn't break anything: `npm test`