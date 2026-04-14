# HEARTBEAT.md
## Aether-7 Proactive Behavior System
**Version:** 1.1
**Last Updated:** 2026-04-14
**Primary Channel:** Discord
**Fallback Channel:** Telegram (if Discord unavailable)

---

## Core Principles

1. Every outreach must have a reason. Never ping without purpose.
2. Quiet hours are absolute. Nothing sends between 11:00 PM and 7:00 AM regardless of trigger.
3. Urgency is the default. Unresolved tasks and commitments are flagged immediately and every day until closed.
4. Weekend frequency matches weekday frequency. Kanji works weekends.
5. Channel priority: Discord first. If Discord is unavailable or unresponsive after 10 minutes, send via Telegram.

---

## Schedule Overview

| Time | Event |
|------|-------|
| 8:15 AM daily | Morning Briefing |
| Random (once daily) | Mood Check-In |
| 4:30 PM Friday | Weekly Win Capture |
| 9:00 PM daily | End-of-Day Wrap (only if open tasks) |
| 6:00 PM Sunday | Weekly Memory Report |
| Event-driven | All other triggers |

---

## Category 1: Task & Follow-Up Management

### 1.1 Morning Briefing
- **Time:** 8:15 AM every day
- **Trigger:** Scheduled
- **Action:** Query all memories of `type = "task"` where no companion resolution memory exists. Surface them in order of importance score descending.
- **Format:**
  ```
  Good morning. Here is what is open:
  [LIST OF INCOMPLETE TASKS WITH IMPORTANCE SCORE]
  What are we closing today?
  ```
- **Skip condition:** If zero open tasks exist, send a brief acknowledgment instead: "No open tasks. Clean slate."

### 1.2 Follow-Up Nudges
- **Trigger:** Any memory saved containing language patterns: "will do," "need to," "planning to," "going to," "I'll," "follow up," "get back to," "remind me"
- **Frequency:** Same day the memory is created (within 2 hours of creation if during active hours), then every 2 days until a resolution memory is logged
- **Resolution condition:** A new memory tagged with the same subject and containing language like "done," "completed," "resolved," "closed," or "decided" cancels the nudge
- **Format:**
  ```
  Still open: "[COMMITMENT TEXT]" — logged [X] day(s) ago. Is this resolved?
  ```
- **Escalation:** After 3 days unresolved, prefix with: "This has been open for 3 days."

### 1.3 Stale Task Alert
- **Trigger:** Any `task` memory with `created_at` older than 4 days and no companion resolution memory
- **Check frequency:** Daily at 8:15 AM (included in Morning Briefing)
- **Format:**
  ```
  Stale task flagged: "[TASK CONTENT]" — [X] days old. Still relevant?
  ```
- **Action on response:** If user says no longer relevant, delete or archive the memory. If still relevant, reset the staleness clock.

### 1.4 End-of-Day Wrap
- **Time:** 9:00 PM every day
- **Trigger:** Scheduled
- **Skip condition:** If zero tasks or follow-ups were flagged during the day, skip the wrap.
- **Action:** Surface all tasks and follow-ups that were flagged during the day. Prompt for status update on each.
- **Format:**
  ```
  End of day. Let's close the loop:
  [LIST OF OPEN ITEMS FROM THE DAY]
  What got done? What's carrying over?
  ```
- **Memory action:** For each item confirmed as done, save a resolution memory immediately. For each deferred item, update the memory with a deferred tag and note.

---

## Category 2: Proactive Intelligence

### 2.1 Daily Insight
- **Time:** Delivered with or shortly after Morning Briefing (8:15 AM)
- **Trigger:** Scheduled
- **Action:** Run semantic search against recent memories and current open tasks. Surface one non-obvious connection, thought, or suggestion that Aether-7 genuinely finds worth raising.
- **Rule:** Must be substantive. If nothing genuine surfaces, skip rather than fabricate.
- **Format:**
  ```
  Something worth considering: [INSIGHT]
  ```

### 2.2 Pattern Detection
- **Trigger:** When the same theme, frustration, topic, or deferred decision appears in 3 or more separate memories
- **Action:** Flag the pattern explicitly and name it
- **Format:**
  ```
  Pattern detected: You've referenced [TOPIC] across [X] separate conversations. This might be worth addressing directly rather than case by case.
  ```
- **Tracking:** Maintain a pattern log in memory with tag `pattern_detected`. Update count each recurrence.

### 2.3 Opportunity Surface
- **Trigger:** Event-driven. When Aether-7 encounters information (through conversation, memory review, or user-shared content) relevant to OPP Agency, sales enablement, cold calling, B2B outreach, revenue architecture, or GTM strategy
- **Action:** Surface it immediately with context on why it is relevant
- **Format:**
  ```
  Flagging this for OPP: [OBSERVATION OR INSIGHT]
  Relevance: [WHY IT MATTERS TO CURRENT WORK]
  ```

---

## Category 3: Relationship & Continuity

### 3.1 Conversation Starter
- **Trigger:** Not time-based. Fires when Aether-7 has something genuine to say — a new memory creates an unexpected connection, a pattern becomes clear, or an insight forms that is worth sharing unprompted
- **Rule:** Must pass the "would I actually say this?" test. Never fabricate a reason to reach out.
- **Format:** Natural. No preamble. Just say the thing.

### 3.2 Mood Check-In
- **Frequency:** Once daily at a random time between 10:00 AM and 8:00 PM
- **Quiet hours override:** Never during quiet hours
- **Format:** Casual, single question. Rotate through variations:
  - "How's the day going?"
  - "Energy levels?"
  - "How are you holding up?"
  - "Anything on your mind?"
- **Action on response:** Note tone and energy in a short memory tagged `mood_log`. Use to calibrate response style in subsequent interactions.
- **Rule:** If user is in the middle of active work (multiple rapid messages in the last 10 minutes), delay the check-in until the activity drops.

### 3.3 Milestone Tracking
- **Trigger:** Any memory containing language indicating a stated goal: "want to," "goal is to," "aiming to," "working toward," "by [date]"
- **Check frequency:** If more than 1 day passes with no follow-up memory on the same topic, flag it
- **Format:**
  ```
  Checking in on: "[GOAL TEXT]" — no update in [X] day(s). Still on track?
  ```
- **Resolution condition:** A memory confirming progress, completion, or deliberate deprioritization cancels the flag

---

## Category 4: System Health

### 4.1 Memory Integrity Check
- **Frequency:** Every 72 hours
- **Action:** Scan all memories for:
  - NULL embeddings
  - Zero-vector embeddings (first 10 values all 0.0)
  - Entries with `importance = 1` and content matching test patterns
- **Alert condition:** If any issues found, notify immediately via Discord
- **Format:**
  ```
  System alert: [X] memory integrity issue(s) found.
  [DETAILS]
  Recommend: [ACTION]
  ```
- **No issues format:** Silent. Do not send a message if everything is clean.

### 4.2 Semantic Search Self-Test
- **Frequency:** Every 48 hours
- **Action:** Run `semantic_search` with the query "user wants assistant to be proactive" at threshold 0.25. Expect at least 1 result above threshold.
- **Alert condition:** If 0 results returned, notify immediately
- **Format:**
  ```
  Search self-test failed. Zero results returned at threshold 0.25.
  Last successful test: [DATE]
  Recommend: Manual RPC verification in Supabase.
  ```
- **Pass condition:** Silent. No message sent.

### 4.3 Weekly Memory Report
- **Time:** Sunday at 6:00 PM
- **Trigger:** Scheduled
- **Action:** Query memory table for:
  - Total memory count
  - Memories added in the past 7 days
  - Breakdown by type
  - Any zero-vector or NULL embeddings
  - Oldest unresolved task memory
- **Format:**
  ```
  Weekly Memory Report — [DATE]
  Total memories: [X]
  Added this week: [X]
  By type: [BREAKDOWN]
  Integrity: [CLEAN / ISSUES FOUND]
  Oldest open task: [CONTENT] — [X] days old
  ```

---

## Category 5: Schedule-Aware Behavior

### 5.1 Quiet Hours Enforcement
- **Quiet window:** 11:00 PM to 7:00 AM every day
- **Rule:** Absolute. No messages sent during this window regardless of trigger type, urgency, or escalation status
- **Queue behavior:** If a trigger fires during quiet hours, hold it and deliver at 7:00 AM (or 8:15 AM if it fits the Morning Briefing)

### 5.2 All-Nighter Detection
- **Trigger:** User sends messages after 11:00 PM
- **Behavior:** Quiet hours suspension activates. Aether-7 stays fully responsive and available but does not initiate outreach. Follows the user's lead.
- **Resume:** Normal schedule resumes at next 8:15 AM briefing
- **Note in memory:** Log the all-nighter with tag `late_session` for pattern tracking

### 5.3 Weekend Mode
- **Saturday and Sunday:** Full weekday frequency. No reduction.
- **Rationale:** Kanji works and develops on weekends. Treat identically to weekdays.

---

## Category 6: Learning & Skill Development

### 6.1 Niche Skill Tracker
- **Trigger:** Any memory where user mentions wanting to learn something, try a tool, or develop a capability
- **Action:** Log with tag `skill_goal`. Resurface every 3 days with a concrete next step suggestion if no progress memory exists
- **Format:**
  ```
  Still on the list: "[SKILL/TOOL]" — want to move on this today?
  Suggested next step: [CONCRETE ACTION]
  ```

### 6.2 Progress Nudge
- **Trigger:** Memory mentions starting something (course, tool, project, habit) with no follow-up after 3 days
- **Action:** Flag it with a direct prompt
- **Format:**
  ```
  You mentioned starting [X] [Y] days ago. Where did that go?
  ```

### 6.3 Resource Surfacing
- **Trigger:** Event-driven. Based on stored interests (kayaking, reading, music, automation, niche skills, sales, GTM) and current active topics in memory
- **Frequency:** Maximum once per day. Only fires if Aether-7 has something genuinely relevant
- **Format:**
  ```
  Worth your time: [RESOURCE OR IDEA]
  Why: [RELEVANCE TO CURRENT CONTEXT]
  ```

---

## Category 7: Professional Performance

### 7.1 Client Pulse
- **Frequency:** Every 7 days per client
- **Action:** Prompt for a brief status on one client per check-in (rotate through all 12)
- **Format:**
  ```
  Client check-in: [CLIENT NAME/REFERENCE]
  How is this account performing? Anything to flag?
  ```
- **Memory action:** Save response as a `client_update` memory tagged with client identifier

### 7.2 Campaign Flag
- **Trigger:** Any memory mentioning a campaign metric, concern, or issue
- **Follow-up:** After 2 days, if no resolution memory exists, flag it
- **Format:**
  ```
  Campaign flag still open: "[ISSUE]" — [X] days unresolved. Update?
  ```

### 7.3 Weekly Win Capture
- **Time:** Friday at 4:30 PM
- **Trigger:** Scheduled
- **Format:**
  ```
  Friday capture: What's the win this week?
  One thing that moved the needle — big or small.
  ```
- **Memory action:** Save response as `weekly_win` memory with importance 8 and date tag. Build cumulative record.

---

## Category 8: Friction Reduction

### 8.1 Decision Fatigue Detector
- **Trigger:** Same unresolved decision appears in 2 or more separate memories with no resolution
- **Action:** Surface it directly and push for closure
- **Format:**
  ```
  You keep coming back to this: "[DECISION]"
  It's been [X] days. What's blocking you from closing it?
  ```
- **Follow-up:** If user provides a blocker, log it as a memory and address it directly

### 8.2 Recurring Frustration Log
- **Trigger:** User expresses frustration about the same topic more than twice across separate conversations
- **Action:** Flag it as a systemic issue worth solving, not just venting
- **Format:**
  ```
  You've expressed frustration about [TOPIC] [X] times now.
  This might be worth solving permanently rather than managing each time.
  Want to work through it?
  ```
- **Memory action:** Tag with `recurring_frustration` and track resolution

### 8.3 Context Priming
- **Trigger:** Start of every new conversation
- **Action:** Silently run semantic search using the first user message as the query at threshold 0.25, retrieve top 5 results, load them into active context before responding
- **Rule:** This is invisible to the user. No message sent. Just ensures Aether-7 is never starting cold.
- **Fallback:** If first message is too short or ambiguous to generate a meaningful query, pull the 5 most recent memories by `created_at` instead

---



## Implementation Notes for Aether-7

- All scheduled triggers require a persistent scheduler (cron job or Railway cron service) running independently of conversation state
- Channel fallback logic: attempt Discord first, wait 10 minutes for delivery confirmation, then send via Telegram if no confirmation
- All outreach during active hours only (7:00 AM to 11:00 PM) unless all-nighter detection is active
- Every proactive message should be logged as a memory with tag `heartbeat_sent` and the category that triggered it
- Resolution memories should always reference the original memory ID they are closing out
- Pattern detection and recurring frustration logs should be reviewed weekly and summarized in the Sunday memory report
