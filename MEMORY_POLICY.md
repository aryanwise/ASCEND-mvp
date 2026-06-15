# Ascend — Memory Policy

---

The rules that keep `user_memory` sharp instead of noisy. Every distiller and every
injection obeys this. If you change limits, change them here first, then in
`src/lib/memory.ts` (the constants are the single source of truth in code).

## Principle

Memory exists to make the coach feel like it KNOWS the user. More memory is not
better — _relevant, recent, durable_ memory is better. A noisy prompt makes the
coach feel dumber, not smarter. When in doubt, store less.

## The keys (in `user_memory`, one row per key)

| Key                  | Type              | Written by         | Capped at           |
| -------------------- | ----------------- | ------------------ | ------------------- |
| `persona`            | string            | settings           | —                   |
| `average_day`        | string            | settings           | 1 short paragraph   |
| `active_days`        | string[]          | streak             | rolling, dates only |
| `inbox`              | object[]          | inbox              | 3 messages          |
| `skip_patterns`      | `{reason: count}` | check-in distiller | top 5 reasons       |
| `strong_days`        | string[]          | check-in distiller | up to 3 weekdays    |
| `weak_days`          | string[]          | check-in distiller | up to 3 weekdays    |
| `facts`              | `{text, ts}[]`    | coach distiller    | 15 most recent      |
| `session_summaries`  | `{text, ts}[]`    | coach distiller    | 10 most recent      |
| `motivation_summary` | string            | coach distiller    | 1–2 sentences       |

## CAPTURE — what we record raw

- Every check-in (completed + skip_reason) → `daily_check_ins`.
- Every coach message → `chat_logs`.
  That's it. Raw tables stay raw; we never inject raw rows into prompts.

## DISTILL — what gets promoted into `user_memory`

**Check-in distiller (counting, no AI), max once/day:**

- Reads last 14 days of check-ins.
- `skip_patterns`: tally skip_reasons, keep top 5 by count.
- `strong_days`/`weak_days`: completion rate per weekday; strong = top, weak = bottom, only if there's enough data (≥3 check-ins on that weekday).

**Coach distiller (one AI call), at session end / every 6 user msgs:**

- Promote a fact ONLY if it is durable and goal-relevant: constraints ("works night shifts"), preferences ("hates mornings"), commitments, recurring blockers.
- DO NOT promote: one-off moods, small talk, anything time-bound ("tired today"), or anything already captured.
- `facts`: append, dedupe by meaning, keep 15 most recent.
- `session_summaries`: one ≤15-word line per session, keep 10 most recent.
- `motivation_summary`: overwrite with the deeper "why" when a stronger one emerges.

## INJECT — what goes into prompts (enforced in `buildMemoryBlock`)

- Coach: average_day, top 3 skip_patterns, strong/weak days, motivation_summary, top 5 facts, last 2 session_summaries.
- Day plan: average_day, strong/weak days, top 3 skip_patterns. (schedule-relevant only)
- Recalibrate: top 3 skip_patterns, motivation_summary, recent recalibrations.
- NEVER inject: full fact list, full summary history, raw check-in rows, inbox.

## IGNORE — never stored as memory

- Anything sensitive the user didn't ask the coach to remember.
- Sentiment/mood of a single message.
- Duplicate facts (promote once, then skip).

## Trimming

Caps are enforced on write (distiller trims before saving) AND on read
(builder slices), so even a bad write can't bloat a prompt.
