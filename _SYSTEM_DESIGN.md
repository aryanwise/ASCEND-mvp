# Ascend — Memory Loop System Design (MVP)

---

The goal: make the AI **actually learn from the user and remember it**, so the coach, day-planner, and interventions all get smarter over time. Right now the app _promises_ this ("learns WHY you slip") but doesn't deliver it. This doc is the plan to close that gap. Kept short and practical — built for 10–20 users, not hypothetical scale.

---

## The core idea

The AI has no built-in memory. "Memory" = **what we choose to store in Supabase and re-inject into each prompt.** So the memory loop is three jobs:

1. **CAPTURE** — record the signals the user generates (skip reasons, completions, what they say to the coach).
2. **DISTILL** — periodically compress raw signals into a few durable facts.
3. **INJECT** — load those facts into every AI prompt so the AI acts like it remembers.

We already do #3 partially. The gaps are #1 (signals are siloed) and #2 (distillation barely runs).

---

## The single source of truth: `user_memory`

Everything the AI "knows" about a user lives in `user_memory` as key→value rows. This is already the right design — we just need to actually fill it. Target keys:

| Key                                     | Written by       | Holds                                     |
| --------------------------------------- | ---------------- | ----------------------------------------- |
| `persona`                               | settings         | coaching tone                             |
| `average_day`                           | settings         | their real schedule                       |
| `active_days`                           | streak           | login-streak dates                        |
| `inbox`                                 | inbox            | AI insight messages                       |
| **`skip_patterns`** _(new)_             | check-in distill | e.g. `{"too tired": 4, "no time": 2}`     |
| **`strong_days` / `weak_days`** _(new)_ | check-in distill | days they actually follow through vs slip |
| **`facts`** _(new)_                     | coach distill    | short bullet facts learned from chats     |
| **`session_summaries`** _(new)_         | coach distill    | 1-line summary per past coach session     |
| **`motivation_summary`** _(new)_        | coach distill    | the deeper "why" in their words           |

These are small JSON blobs. For 20 users this is nothing — no scale concern.

---

## Job 1: CAPTURE (mostly already there, one fix)

- **Check-ins** already write `daily_check_ins` (completed + skip_reason). ✅
- **Coach messages** already write `chat_logs`. ✅
- **Fix:** make sure skip_reason is actually being captured when a user defers/skips — it's the highest-value signal and currently underused.

No new heavy infrastructure. The raw data is already landing.

---

## Job 2: DISTILL (the missing piece — this is what we build)

Two lightweight distillers that compress raw rows into `user_memory` facts. Both run **opportunistically** (on a natural trigger), not on a cron — simplest for an MVP with no background workers.

### A. Check-in distiller

- **Trigger:** runs inside `/api/tasks/checkin` (fire-and-forget, after the response) OR when Home loads, throttled to once/day.
- **What it does:** reads the last ~14 days of `daily_check_ins`, tallies skip reasons and which weekdays have the best/worst completion, writes `skip_patterns`, `strong_days`, `weak_days`.
- **No AI needed** — it's just counting. Fast, free, reliable.

### B. Coach distiller

- **Trigger:** at the end of a coach session (or every N messages), fire-and-forget.
- **What it does:** sends the session transcript to Groq once with "extract durable facts + a 1-line summary + any motivation insight." Appends to `facts`, `session_summaries`, updates `motivation_summary`.
- **Bounded:** keep `facts` to ~15 most-recent, `session_summaries` to ~10. Trim oldest. Keeps prompts small and costs flat.

This is the loop that's missing today. Once it runs, `user_memory` fills with real learned content instead of just settings.

---

## Job 3: INJECT (tighten what exists)

Every AI prompt gets a compact **MEMORY block** assembled from `user_memory`:

```
WHAT I KNOW ABOUT {name}:
- Typical day: {average_day}
- Tends to skip when: {top skip_patterns}
- Follows through best on: {strong_days}; slips on: {weak_days}
- Their why: {motivation_summary}
- Notes: {facts, top 5}
- Recently we discussed: {last 2 session_summaries}
```

- **Coach** — gets the full block + recent chat history. (Add skip_patterns + session_summaries, which it's missing now.)
- **Day plan** — gets schedule-relevant parts (average_day, strong/weak days, skip_patterns) so it stops scheduling things on days the user always misses.
- **Recalibrate** — gets skip_patterns + past recalibrations so it stops re-proposing what already failed.

One shared helper builds this block so all three stay consistent.

---

## Reliability guardrails (cheap, do alongside)

Since we're touching the AI paths anyway, add these — they're what actually protects 10–20 real users:

1. **Groq wrapper with timeout + one retry + safe fallback.** If JSON parse fails or Groq times out, return a sensible default (e.g. a basic plan from tasks) instead of a 500. The user never sees a hard failure.
2. **Distillers are fire-and-forget and wrapped in try/catch** — a distiller failing must never break the user's actual request.
3. **Writes return success/failure the UI can see** — no more silent RLS-style failures. (We already moved writes to service-role routes; just surface errors.)

---

## What we are NOT doing (scope discipline)

- No vector DB / embeddings — overkill for 20 users and this data size. Plain key→value + small AI summaries is enough and far more debuggable.
- No background cron/workers — opportunistic triggers are simpler and sufficient.
- No `goal_snapshots` yet — nice for trend charts later, not needed for the memory loop.
- Drop `priorities` (dead table) in a later cleanup — harmless for now.

---

## Build order

1. **Shared memory-block builder** (`lib/memory.ts`) — one function that reads `user_memory` and returns the MEMORY block string. Wire into coach, day-plan, recalibrate.
2. **Check-in distiller** — counting-based, writes skip_patterns/strong_days/weak_days. (Biggest bang, no AI cost.)
3. **Coach distiller** — AI summary at session end → facts/session_summaries/motivation_summary.
4. **Groq reliability wrapper** — timeout + retry + fallback.
5. Verify the loop: skip a task with a reason → check the coach now references it.

Each step is independently shippable and testable. Step 1+2 alone will already make the app feel dramatically more "aware."
