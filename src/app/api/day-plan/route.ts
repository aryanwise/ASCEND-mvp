import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Block { time: string; task: string; area: string; duration?: string; }
interface Deferred { task: string; reason: string; }
interface PlanOut { blocks: Block[]; deferred: Deferred[]; advice: string; }

export async function POST(req: NextRequest) {
  try {
    const { userId, date, mode, energy, hours, mood, todayNote } = await req.json();
    if (!userId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const isTune = mode === 'tune';

    const db = supabaseAdmin();
    const [{ data: profile }, { data: goals }, { data: memory }] = await Promise.all([
      db.from('profiles').select('archetype').eq('id', userId).maybeSingle(),
      db.from('goals').select('id, title, area, duration, tasks(name, frequency, duration)').eq('user_id', userId).eq('status', 'active'),
      db.from('user_memory').select('key, value').eq('user_id', userId).in('key', ['persona', 'average_day']),
    ]);

    const memMap: Record<string, unknown> = {};
    (memory || []).forEach((m) => { memMap[m.key] = m.value; });
    const persona = (memMap.persona as string) || 'balanced';
    const averageDay = (memMap.average_day as string) || '';

    const goalCtx = (goals || [])
      .map((g) => {
        const tlist = (g as { tasks?: { name: string; frequency?: string; duration?: string }[] }).tasks || [];
        const ts = tlist.map((t) => `  • ${t.name} [${g.area}] (${t.frequency || ''} ${t.duration || ''})`).join('\n');
        return `${g.title} (${g.area}${g.duration ? `, ${g.duration}` : ''}):\n${ts}`;
      })
      .join('\n\n') || '(no active goals)';

    // Quick mode: plan purely from goals + deadlines, no extra input.
    // Tune mode: weave in the user's free-text "anything specific today" note
    // plus energy / hours / mood. The AI decides the balance case by case.
    const system = (isTune
      ? 'You are Ascend\'s day planner. Build a realistic time-blocked schedule that balances the user\'s active goal tasks/deadlines WITH the specific things they said they need to do today. Weigh them case by case — sometimes a one-off today item matters more than a recurring goal task, sometimes not. Respect their energy, available hours, mood, archetype, AND their typical daily commitments (classes, work hours, etc) — schedule goal work into the gaps around those, never on top of them. Do NOT overload them — if energy is low or hours are few, schedule less and DEFER the rest with a short honest reason. Each block needs a clock time (e.g. "9:00 AM"), the task, and its area key. Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"fitness","duration":"30 min"}],"deferred":[{"task":"...","reason":"..."}],"advice":"one sharp sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.'
      : 'You are Ascend\'s day planner. Build a realistic time-blocked schedule purely from the user\'s active goal tasks and their deadlines/durations, respecting their archetype AND their typical daily commitments (classes, work hours, etc) — fit goal work into the free gaps around those, never on top of them. Prioritize tasks tied to nearer deadlines. Don\'t overload a day — DEFER what doesn\'t fit with a short honest reason. Each block needs a clock time (e.g. "9:00 AM"), the task, and its area key. Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"fitness","duration":"30 min"}],"deferred":[{"task":"...","reason":"..."}],"advice":"one sharp sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.')
      + `\n\n${personaTone(persona)} Apply this tone to the "advice" line.`;

    const userMsg = isTune
      ? `Archetype: ${profile?.archetype || 'unknown'}\n${averageDay ? `Typical day: ${averageDay}\n` : ''}Energy: ${energy || 'Medium'}\nHours available: ${hours ?? 'unspecified'}\nMood: ${mood || 'neutral'}\n\nANYTHING SPECIFIC FOR TODAY (user's own words):\n${todayNote?.trim() || '(nothing extra)'}\n\nGOALS & TASKS:\n${goalCtx}`
      : `Archetype: ${profile?.archetype || 'unknown'}\n${averageDay ? `Typical day: ${averageDay}\n` : ''}\nGOALS & TASKS (plan from these and their deadlines):\n${goalCtx}`;

    const raw = await groq(
      [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      { json: true, temperature: 0.6, maxTokens: 1100 }
    );

    const out = parseJSON<PlanOut>(raw, { blocks: [], deferred: [], advice: 'Start with the most important thing first.' });

    const blocks = (out.blocks || []).map((b) => ({ ...b, done: false }));

    // Persist the tune inputs. We fold the free-text "today" note into
    // mood_context alongside the mood chips so it survives reloads.
    const moodStore = isTune
      ? [mood, todayNote?.trim()].filter(Boolean).join(' | ') || null
      : null;

    await db.from('day_plans').upsert(
      {
        user_id: userId,
        date,
        energy: isTune ? (energy || null) : null,
        hours_available: isTune ? (hours ?? null) : null,
        mood_context: moodStore,
        blocks,
        deferred: out.deferred || [],
        advice: out.advice || null,
      },
      { onConflict: 'user_id,date' }
    );

    return NextResponse.json({ blocks, deferred: out.deferred || [], advice: out.advice || '' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
