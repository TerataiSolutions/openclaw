# SCHEDULES.md – Timing and Frequency Reference

This file contains all schedule tables, time entries, and cron descriptions referenced by HEARTBEAT.md. Aether‑7 reads this file at session start to know when each proactive behavior triggers.

---

## Schedule Overview

| Time | Event |
|------|-------|
| 8:15 AM daily (weekends: 12:00 PM) | Morning Briefing |
| Random (once daily, 10:00 AM–8:00 PM weekdays, 12:00 PM–8:00 PM weekends) | Mood Check-In |
| 4:30 PM Friday | Weekly Win Capture |
| 9:00 PM daily | End-of-Day Wrap (only if open tasks) |
| 6:00 PM Sunday | Weekly Memory Report |
| 8:05 AM Monday | Monday Morning Strategic Briefing |
| Event-driven | All other triggers |

*Weekends:* after 10 AM Eastern.

---

## Detailed Category Schedules

The following table maps each HEARTBEAT.md category and subcategory to its timing and frequency rules.

| Category | Subcategory | Time / Frequency | Notes |
|----------|-------------|------------------|-------|
| 1.1 | Morning Briefing | 8:15 AM weekdays, 12:00 PM Eastern (16:00 UTC) weekends | Skip if zero open tasks. |
| 1.2 | Follow-Up Nudges | Same day the memory is created (within 2 hours if during active hours), then every 2 days until resolution | Triggered by language patterns: “will do”, “need to”, “planning to”, “going to”, “I'll”, “follow up”, “get back to”, “remind me”. |
| 1.3 | Stale Task Alert | Daily at 8:15 AM weekdays, 12:00 PM weekends (included in Morning Briefing) | Flags any `task` memory older than 4 days with no resolution memory. |
| 1.4 | End-of-Day Wrap | 9:00 PM every day | Skip if zero tasks or follow-ups flagged that day. |
| 2.1 | Daily Insight | Delivered with or shortly after Morning Briefing (8:15 AM weekdays, 12:00 PM weekends) | Must be substantive; skip if nothing genuine surfaces. |
| 2.2 | Pattern Detection | Event‑driven (theme appears ≥3 times) | No fixed schedule. |
| 2.3 | Opportunity Surface | Event‑driven (relevant OPP/sales/GTM info encountered) | Maximum once per day; only if genuinely relevant. |
| 3.1 | Conversation Starter | Not time‑based (fires when Aether‑7 has something genuine to say) | No fixed schedule. |
| 3.2 | Mood Check‑In | Random once daily between 10:00 AM–8:00 PM weekdays, 12:00 PM–8:00 PM weekends Eastern | Never during quiet hours; delay if user is in active work. |
| 3.3 | Milestone Tracking | Event‑driven (memory contains goal language); check frequency: if >1 day passes with no follow‑up, flag it | No fixed schedule. |
| 4.1 | Memory Integrity Check | Every 72 hours | Alerts only if issues found. |
| 4.2 | Semantic Search Self‑Test | Every 48 hours | Alerts only if 0 results above threshold. |
| 4.3 | Weekly Memory Report | Sunday at 6:00 PM Eastern | Always runs. |
| 5.1 | Quiet Hours Enforcement | Absolute quiet window: 11:00 PM to 8:00 AM every day | No messages sent during this window. |
| 5.2 | All‑Nighter Detection | Trigger: user sends messages after 11:00 PM | Suspends quiet hours; follows user’s lead. |
| 5.3 | Weekend Mode | Saturday and Sunday: scheduled outreach shifts to after 10:00 AM Eastern (14:00 UTC) | Morning Briefing moves to 12:00 PM Eastern; Mood Check‑In window shifts accordingly. |
| 6.1 | Niche Skill Tracker | Event‑driven (memory mentions wanting to learn something); resurface every 3 days if no progress | No fixed schedule. |
| 6.2 | Progress Nudge | Trigger: memory mentions starting something with no follow‑up after 3 days | Event‑driven. |
| 6.3 | Resource Surfacing | Maximum once per day, only if Aether‑7 has something genuinely relevant | Event‑driven. |
| 7.1 | Client Pulse | Every 7 days per client (rotating) | Prompt for status on one client at a time. |
| 7.2 | Campaign Flag | After 2 days if no resolution memory exists | Event‑driven. |
| 7.3 | Weekly Win Capture | Friday at 4:30 PM Eastern | Always runs. |
| 8.1 | Decision Fatigue Detector | Event‑driven (same unresolved decision appears ≥2 times) | No fixed schedule. |
| 8.2 | Recurring Frustration Log | Event‑driven (frustration expressed >2 times across conversations) | No fixed schedule. |
| 8.3 | Context Priming | Start of every new conversation | Invisible to user; uses semantic search or recent memories. |
| 9.1 | Monday Morning Strategic Briefing | 8:05 AM Eastern every Monday | Uses last 7 days of memories; runs regardless of data volume. |

---

## Cron Job Mappings

The following cron entries in `/data/.openclaw/workspace/cron/index.js` implement the above schedules:

- Morning Briefing: `0 8 * * *` (weekdays) / `0 12 * * 0,6` (weekends)
- Mood Check‑In: random time within windows (managed by cron manager)
- Weekly Win Capture: `0 16 * * 5`
- End‑of‑Day Wrap: `0 21 * * *`
- Weekly Memory Report: `0 18 * * 0`
- Monday Morning Strategic Briefing: `5 8 * * 1`
- Market Pulse: `0 7 * * *`
- Memory Consolidator: `0 17 * * 0`
- Weekly Context Snapshot: `5 18 * * 0`

*(Note: Exact cron expressions may vary; refer to `cron/index.js` for the current implementation.)*