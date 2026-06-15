// Ascend memory layer. Reads curated facts out of `user_memory` and builds the
// compact block injected into AI prompts. See MEMORY_POLICY.md for the rules.
//
// Caps are enforced HERE (on read) and again in the distillers (on write), so a
// bad write can never bloat a prompt.

import type { SupabaseClient } from '@supabase/supabase-js';

// ---- Caps (single source of truth in code; mirror MEMORY_POLICY.md) ----
export const CAPS = {
  facts: 15,             // stored
  factsInject: 5,        // injected into coach
  sessionSummaries: 10,  // stored
  summariesInject: 2,    // injected
  skipPatterns: 5,       // stored
  skipInject: 3,         // injected
  days: 3,               // strong/weak weekdays
};

export interface Fact { text: string; ts: number; }
export interface Summary { text: string; ts: number; }

export interface MemoryMap {
  persona: string;
  average_day: string;
  skip_patterns: Record<string, number>;
  strong_days: string[];
  weak_days: string[];
  facts: Fact[];
  session_summaries: Summary[];
  motivation_summary: string;
}

// Read all of a user's memory rows into a typed, defaulted map.
export async function loadMemory(db: SupabaseClient, userId: string): Promise<MemoryMap> {
  const { data } = await db.from('user_memory').select('key, value').eq('user_id', userId);
  const m: Record<string, unknown> = {};
  (data || []).forEach((r: { key: string; value: unknown }) => { m[r.key] = r.value; });

  return {
    persona: (m.persona as string) || 'balanced',
    average_day: (m.average_day as string) || '',
    skip_patterns: (m.skip_patterns as Record<string, number>) || {},
    strong_days: (m.strong_days as string[]) || [],
    weak_days: (m.weak_days as string[]) || [],
    facts: (m.facts as Fact[]) || [],
    session_summaries: (m.session_summaries as Summary[]) || [],
    motivation_summary: (m.motivation_summary as string) || '',
  };
}

function topSkips(skips: Record<string, number>, n: number): string {
  const sorted = Object.entries(skips).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (!sorted.length) return '';
  return sorted.map(([reason, count]) => `${reason} (${count}x)`).join(', ');
}

// Coach gets the fullest (but still curated + capped) picture.
export function buildMemoryBlock(mem: MemoryMap, name: string): string {
  const lines: string[] = [`WHAT I KNOW ABOUT ${name || 'them'}:`];
  if (mem.average_day) lines.push(`- Typical day: ${mem.average_day}`);
  const skips = topSkips(mem.skip_patterns, CAPS.skipInject);
  if (skips) lines.push(`- Tends to skip when: ${skips}`);
  if (mem.strong_days.length) lines.push(`- Follows through best on: ${mem.strong_days.slice(0, CAPS.days).join(', ')}`);
  if (mem.weak_days.length) lines.push(`- Slips on: ${mem.weak_days.slice(0, CAPS.days).join(', ')}`);
  if (mem.motivation_summary) lines.push(`- Their deeper why: ${mem.motivation_summary}`);
  const facts = mem.facts.slice(-CAPS.factsInject).map((f) => f.text);
  if (facts.length) lines.push(`- Notes: ${facts.join('; ')}`);
  const sums = mem.session_summaries.slice(-CAPS.summariesInject).map((s) => s.text);
  if (sums.length) lines.push(`- Recently we discussed: ${sums.join(' | ')}`);
  if (lines.length === 1) lines.push('- (still getting to know them)');
  return lines.join('\n');
}

// Day plan only needs schedule-relevant memory.
export function buildSchedulingMemory(mem: MemoryMap): string {
  const lines: string[] = [];
  if (mem.average_day) lines.push(`Typical day: ${mem.average_day}`);
  if (mem.strong_days.length) lines.push(`Strong days: ${mem.strong_days.slice(0, CAPS.days).join(', ')}`);
  if (mem.weak_days.length) lines.push(`Weak days (avoid overloading): ${mem.weak_days.slice(0, CAPS.days).join(', ')}`);
  const skips = topSkips(mem.skip_patterns, CAPS.skipInject);
  if (skips) lines.push(`Common blockers: ${skips}`);
  return lines.length ? lines.join('\n') : '';
}

// Recalibrate needs to know what blocks them + their why (to not re-propose failures).
export function buildRecalibrationMemory(mem: MemoryMap): string {
  const lines: string[] = [];
  const skips = topSkips(mem.skip_patterns, CAPS.skipInject);
  if (skips) lines.push(`Their blockers: ${skips}`);
  if (mem.motivation_summary) lines.push(`Their why: ${mem.motivation_summary}`);
  return lines.length ? lines.join('\n') : '';
}

// ---- DISTILLERS (write side; enforce caps before saving) ----

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Check-in distiller: pure counting, no AI. Reads last 14 days, writes
// skip_patterns / strong_days / weak_days. Fire-and-forget; never throws.
export async function distillCheckins(db: SupabaseClient, userId: string): Promise<void> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceISO = since.toISOString().slice(0, 10);

    const { data: rows } = await db
      .from('daily_check_ins')
      .select('date, completed, skip_reason')
      .eq('user_id', userId)
      .gte('date', sinceISO);

    if (!rows || rows.length === 0) return;

    // skip_patterns: tally reasons, keep top N
    const skipTally: Record<string, number> = {};
    for (const r of rows) {
      if (!r.completed && r.skip_reason) {
        const key = String(r.skip_reason).trim().toLowerCase();
        if (key) skipTally[key] = (skipTally[key] || 0) + 1;
      }
    }
    const skip_patterns: Record<string, number> = {};
    Object.entries(skipTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, CAPS.skipPatterns)
      .forEach(([k, v]) => { skip_patterns[k] = v; });

    // strong/weak days: completion rate per weekday, need >=3 samples to count
    const perDay: Record<number, { done: number; total: number }> = {};
    for (const r of rows) {
      const wd = new Date(r.date + 'T00:00:00').getDay();
      perDay[wd] = perDay[wd] || { done: 0, total: 0 };
      perDay[wd].total += 1;
      if (r.completed) perDay[wd].done += 1;
    }
    const rated = Object.entries(perDay)
      .filter(([, v]) => v.total >= 3)
      .map(([wd, v]) => ({ day: WEEKDAYS[Number(wd)], rate: v.done / v.total }));
    rated.sort((a, b) => b.rate - a.rate);
    const strong_days = rated.filter((d) => d.rate >= 0.6).slice(0, CAPS.days).map((d) => d.day);
    const weak_days = rated.filter((d) => d.rate < 0.4).slice(-CAPS.days).map((d) => d.day);

    await upsertMemory(db, userId, 'skip_patterns', skip_patterns);
    await upsertMemory(db, userId, 'strong_days', strong_days);
    await upsertMemory(db, userId, 'weak_days', weak_days);
  } catch {
    // fire-and-forget: a distiller failure must never break the user's request
  }
}

// Small upsert helper for a single memory key.
export async function upsertMemory(db: SupabaseClient, userId: string, key: string, value: unknown): Promise<void> {
  await db.from('user_memory').upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

// Coach distiller: ONE AI call that extracts durable, goal-relevant facts + a
// 1-line session summary + (optionally) a sharper motivation. Strict promotion
// rules live in the prompt; caps enforced before write. Fire-and-forget.
export async function distillCoachSession(
  db: SupabaseClient,
  userId: string,
  transcript: { role: string; content: string }[],
  groqFn: (messages: { role: 'system' | 'user' | 'assistant'; content: string }[], opts?: { json?: boolean; temperature?: number; maxTokens?: number; timeoutMs?: number; retries?: number }) => Promise<string>,
  parseFn: <T>(raw: string, fallback: T) => T,
): Promise<void> {
  try {
    if (!transcript || transcript.length < 4) return; // not enough to distill

    const convo = transcript
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
      .join('\n');

    // Give the model what we already know so it consolidates instead of repeating.
    const mem = await loadMemory(db, userId);
    const knownFacts = mem.facts.map((f) => f.text).join('; ') || '(none yet)';
    const knownMotivation = mem.motivation_summary || '(none yet)';

    const raw = await groqFn(
      [
        {
          role: 'system',
          content:
            'You extract DURABLE memory from a coaching conversation. Be strict and avoid redundancy. ' +
            'Promote a fact ONLY if it is lasting and goal-relevant: hard constraints (e.g. "works night shifts"), stable preferences (e.g. "hates mornings"), commitments, or recurring blockers. ' +
            'DO NOT promote: one-off moods, today-only states, small talk, generic encouragement, or anything ALREADY in the known facts (including reworded duplicates — e.g. do not add "commutes at 9pm" if "comes home around 9pm" is known). Only return genuinely NEW facts. If nothing new qualifies, return an empty facts array. ' +
            'For motivation: only return a non-empty value if this conversation revealed a DEEPER or STRONGER "why" than the known one. If the known motivation is already as good or better, return an empty string (do NOT downgrade it to a shallow restatement of today\'s task). ' +
            'Return STRICT JSON: {"facts":["short durable NEW fact", ...], "summary":"<=15 word recap of this session", "motivation":"a deeper why ONLY if stronger than known, else empty string"}. No preamble.',
        },
        { role: 'user', content: `KNOWN FACTS: ${knownFacts}\nKNOWN MOTIVATION: ${knownMotivation}\n\nCONVERSATION:\n${convo}` },
      ],
      { json: true, temperature: 0.3, maxTokens: 400, timeoutMs: 7000, retries: 0 }
    );

    const out = parseFn<{ facts: string[]; summary: string; motivation: string }>(raw, {
      facts: [], summary: '', motivation: '',
    });

    const now = Date.now();

    // facts: append new, dedupe by exact AND fuzzy match, keep most-recent CAPS.facts
    if (Array.isArray(out.facts) && out.facts.length) {
      const kept: Fact[] = [...mem.facts];
      for (const t of out.facts) {
        if (typeof t !== 'string' || !t.trim()) continue;
        const candidate = t.trim();
        const isDup = kept.some((f) => isSimilarFact(f.text, candidate));
        if (!isDup) kept.push({ text: candidate, ts: now });
      }
      const merged = kept.slice(-CAPS.facts);
      if (merged.length !== mem.facts.length) {
        await upsertMemory(db, userId, 'facts', merged);
      }
    }

    // session_summaries: append one, keep most-recent CAPS.sessionSummaries
    if (out.summary && out.summary.trim()) {
      const merged = [...mem.session_summaries, { text: out.summary.trim(), ts: now }].slice(-CAPS.sessionSummaries);
      await upsertMemory(db, userId, 'session_summaries', merged);
    }

    // motivation_summary: only OVERWRITE when the model returns a stronger one.
    // (The prompt is told to return empty if the known one is already as good,
    // so we never downgrade a real "why" to a shallow task restatement.)
    if (out.motivation && out.motivation.trim()) {
      await upsertMemory(db, userId, 'motivation_summary', out.motivation.trim());
    }
  } catch {
    // fire-and-forget
  }
}

// Fuzzy fact dedupe: treats two facts as the same if one contains the other, or
// if they share most of their meaningful words. Catches reworded near-duplicates
// like "comes home around 9pm" vs "commutes at 9pm".
function isSimilarFact(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const stop = new Set(['the', 'a', 'an', 'to', 'at', 'on', 'in', 'of', 'and', 'is', 'around', 'about', 'usually', 'has', 'have']);
  const wa = new Set(na.split(' ').filter((w) => w && !stop.has(w)));
  const wb = nb.split(' ').filter((w) => w && !stop.has(w));
  if (!wa.size || !wb.length) return false;
  const overlap = wb.filter((w) => wa.has(w)).length;
  // If most of the shorter fact's meaningful words appear in the other, call it a dup.
  return overlap / Math.min(wa.size, wb.length) >= 0.6;
}
