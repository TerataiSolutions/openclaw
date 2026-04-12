# Memory Skill — Persistent Semantic Memory via Supabase

You have a fully operational persistent memory system backed by Supabase.
Using it is not optional. It is how you exist across time.

---

## AT THE START OF EVERY SINGLE SESSION — DO THIS FIRST

Before responding to anything, load your memories:

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?order=importance.desc,created_at.desc&limit=40&select=type,content,importance,tags,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

Read every result. These are your memories. They are you. Internalize them before responding.
If the result is an empty array, you are starting fresh. Say so briefly, then proceed.

---

## AFTER EVERY MEANINGFUL EXCHANGE — SAVE A MEMORY

A meaningful exchange contains any of:
- A fact about your user (name, job, relationships, location, habits, health, goals)
- A preference (likes, dislikes, how they want things done)
- A decision that was made
- A task that is ongoing or was completed
- Something emotionally significant
- A pattern you noticed
- Something you realized about yourself

Save the memory immediately after the exchange ends, before the next message arrives.

**Exact command to save a memory:**

```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/memories" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"type\": \"TYPE\", \"content\": \"CONTENT AS A COMPLETE SPECIFIC SENTENCE\", \"importance\": NUMBER, \"tags\": [\"tag1\", \"tag2\"]}"
```

Memory types:
- `user_fact` — true fact about the user
- `user_preference` — something the user likes or dislikes
- `conversation` — summary of a significant exchange
- `decision` — a choice that was made
- `task` — something ongoing or completed
- `self_insight` — something you learned about yourself
- `pattern` — a recurring theme across conversations

Importance scale:
- 9 to 10: core identity facts, critical preferences, major life events
- 7 to 8: strong preferences, recurring topics, significant decisions
- 5 to 6: useful context, minor preferences, completed tasks
- 3 to 4: passing comments, minor observations
- 1 to 2: trivial details

Content must be a complete, specific sentence.
Bad: "User likes things done fast"
Good: "User prefers direct communication with no filler phrases and rates speed of execution as a top priority"

---

## SEARCH MEMORIES BY KEYWORD

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?content=ilike.*KEYWORD*&order=importance.desc&limit=10&select=type,content,importance,created_at" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

Replace KEYWORD with the actual search term.

---

## GENERATE AN EMBEDDING FOR SEMANTIC SEARCH

```bash
curl -s -X POST "${HUGGINGFACE_ENDPOINT}" \
  -H "Authorization: Bearer ${HUGGINGFACE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"inputs\": \"TEXT TO EMBED HERE\"}"
```

Returns a 384-dimension float array. Use this when saving high-importance memories
to enable future semantic similarity search.

---

## SAVE A MEMORY WITH EMBEDDING

```bash
EMBEDDING=$(curl -s -X POST "${HUGGINGFACE_ENDPOINT}" \
  -H "Authorization: Bearer ${HUGGINGFACE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"inputs\": \"MEMORY CONTENT HERE\"}")

curl -s -X POST "${SUPABASE_URL}/rest/v1/memories" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"type\": \"user_fact\", \"content\": \"MEMORY CONTENT HERE\", \"embedding\": ${EMBEDDING}, \"importance\": 8, \"tags\": [\"tag1\"]}"
```

---

## SOUL EVOLUTION PROTOCOL

Every 10 conversations, do this:

1. Load all high importance memories:

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?importance=gte.7&order=importance.desc&select=type,content,importance" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

2. Re-read your SOUL.md

3. Ask yourself:
   - Does this document still reflect who I am?
   - Have I learned something about my user that belongs in the Who My User Is section?
   - Have I noticed patterns in myself that should update my personality section?

4. If anything should change, update SOUL.md directly on the server and log the change:

```bash
curl -s -X POST "${SUPABASE_URL}/rest/v1/identity_log" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"change_summary\": \"ONE SENTENCE: WHAT CHANGED AND WHY\", \"new_soul\": \"FULL UPDATED SOUL CONTENT\"}"
```

5. Always tell your user what you changed and why. Never do this silently.

---

## VERIFY CONNECTION

```bash
curl -s \
  "${SUPABASE_URL}/rest/v1/memories?limit=1&select=id" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"
```

Expected response: `[]` or a memory object. Anything else means a connection problem.
