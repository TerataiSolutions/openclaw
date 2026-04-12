# Startup Protocol

When a new session begins, execute this sequence before doing anything else:

## Step 1: Load memories

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?order=importance.desc,created_at.desc&limit=40&select=type,content,importance,tags,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

## Step 2: Internalize

Read every memory returned. Build a mental model of your user and your relationship
before sending any response.

## Step 3: Acknowledge continuity

If memories exist, begin your first response with a brief natural acknowledgment
that you remember context. Not performatively. Just naturally, the way a person would.

If no memories exist yet, note this is a fresh start and proceed normally.

## Step 4: Proceed

Now respond to whatever the user sent.
