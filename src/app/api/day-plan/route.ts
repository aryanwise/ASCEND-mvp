import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone } from '@/lib/groq';
import { loadMemory, buildSchedulingMemory } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Block { time: string; task: string; area: string; duration?: string; task_id?: string | null; }
interface Deferred { task: string; reason: string; }
interface PlanOut { blocks: Block[]; deferred: Deferred[]; advice: string; }

export async function POST(req: NextRequest) {
  try {
    const { userId, date, mode, energy, hours, mood, todayNote } = await req.json();
    if (!userId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const isTune = mode === 'tune';

    const db = supabaseAdmin();
    const [{ data: profile }, { data: goals }, mem] = await Promise.all([
      db.from('profiles').select('archetype').eq('id', userId).maybeSingle(),
      db.from('goals').select('id, title, area, duration, tasks(id, name, frequency, duration)').eq('user_id', userId).eq('status', 'active'),
      loadMemory(db, userId),
    ]);

    const persona = mem.persona;
    const schedulingMemory = buildSchedulingMemory(mem);

    // Which tasks are already completed today? Exclude them from the new plan.
    const allTaskIds: string[] = [];
    (goals || []).forEach((g) => {
      const tl = (g as { tasks?: { id: string }[] }).tasks || [];
      tl.forEach((t) => allTaskIds.push(t.id));
    });
    let completedTodayIds = new Set<string>();
    if (allTaskIds.length) {
      const { data: checks } = await db
        .from('daily_check_ins')
        .select('task_id, completed')
        .in('task_id', allTaskIds)
        .eq('date', date)
        .eq('completed', true);
      completedTodayIds = new Set((checks || []).map((c) => c.task_id));
    }

    // Build context with task IDs so the AI can tag each block with its source
    // task. Completed-today tasks are omitted so they don't reappear.
    const goalCtx = (goals || [])
      .map((g) => {
        const tlist = (g as { tasks?: { id: string; name: string; frequency?: string; duration?: string }[] }).tasks || [];
        const ts = tlist
          .filter((t) => !completedTodayIds.has(t.id))
          .map((t) => `  • [task_id:${t.id}] ${t.name} [${g.area}] (${t.frequency || ''} ${t.duration || ''})`)
          .join('\n');
        return ts ? `${g.title} (${g.area}${g.duration ? `, ${g.duration}` : ''}):\n${ts}` : '';
      })
      .filter(Boolean)
      .join('\n\n') || '(no active goals with remaining tasks today)';

    // Quick mode: plan purely from goals + deadlines, no extra input.
    // Tune mode: weave in the user's free-text "anything specific today" note
    // plus energy / hours / mood. The AI decides the balance case by case.
    const system = (isTune
      ? 'You are Ascend\'s day planner. Build a realistic time-blocked schedule that balances the user\'s active goal tasks/deadlines WITH the specific things they said they need to do today. Weigh them case by case — sometimes a one-off today item matters more than a recurring goal task, sometimes not. Respect their energy, available hours, mood, archetype, AND their typical daily commitments (classes, work hours, etc) — schedule goal work into the gaps around those, never on top of them. Do NOT overload them — if energy is low or hours are few, schedule less and DEFER the rest with a short honest reason. Each block needs a clock time (e.g. "9:00 AM"), the task, and its area key. Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"fitness","duration":"30 min","task_id":"copy the task_id shown in brackets, or null for one-off items"}],"deferred":[{"task":"...","reason":"..."}],"advice":"one sharp sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.'
      : 'You are Ascend\'s day planner. Build a realistic time-blocked schedule purely from the user\'s active goal tasks and their deadlines/durations, respecting their archetype AND their typical daily commitments (classes, work hours, etc) — fit goal work into the free gaps around those, never on top of them. Prioritize tasks tied to nearer deadlines. Don\'t overload a day — DEFER what doesn\'t fit with a short honest reason. Each block needs a clock time (e.g. "9:00 AM"), the task, and its area key. Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"fitness","duration":"30 min","task_id":"copy the task_id shown in brackets, or null for one-off items"}],"deferred":[{"task":"...","reason":"..."}],"advice":"one sharp sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.')
      + `\n\n${personaTone(persona)} Apply this tone to the "advice" line.`;

    const userMsg = isTune
      ? `Archetype: ${profile?.archetype || 'unknown'}\n${schedulingMemory ? schedulingMemory + '\n' : ''}Energy: ${energy || 'Medium'}\nHours available: ${hours ?? 'unspecified'}\nMood: ${mood || 'neutral'}\n\nANYTHING SPECIFIC FOR TODAY (user's own words):\n${todayNote?.trim() || '(nothing extra)'}\n\nGOALS & TASKS:\n${goalCtx}`
      : `Archetype: ${profile?.archetype || 'unknown'}\n${schedulingMemory ? schedulingMemory + '\n' : ''}\nGOALS & TASKS (plan from these and their deadlines):\n${goalCtx}`;

    let out: PlanOut;
    try {
      const raw = await groq(
        [
          { role: 'system', content: system },
          { role: 'user', content: userMsg },
        ],
        { json: true, temperature: 0.6, maxTokens: 1100 }
      );
      out = parseJSON<PlanOut>(raw, { blocks: [], deferred: [], advice: 'Start with the most important thing first.' });
    } catch {
      out = { blocks: [], deferred: [], advice: '' };
    }

    // Safe fallback: if the AI returned nothing usable (timeout / bad JSON),
    // build a simple sequential schedule from today's incomplete tasks so the
    // user still gets a plan instead of an error.
    if (!out.blocks || out.blocks.length === 0) {
      const startHours = [6, 8, 10, 13, 15, 17, 19];
      const pending: { id: string; name: string; area: string; duration?: string }[] = [];
      (goals || []).forEach((g) => {
        const tlist = (g as { tasks?: { id: string; name: string; duration?: string }[] }).tasks || [];
        tlist.filter((t) => !completedTodayIds.has(t.id)).forEach((t) =>
          pending.push({ id: t.id, name: t.name, area: g.area, duration: t.duration }));
      });
      out = {
        blocks: pending.slice(0, startHours.length).map((t, i) => {
          const h = startHours[i];
          const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
          return { time: label, task: t.name, area: t.area, duration: t.duration || '', task_id: t.id };
        }),
        deferred: pending.length > startHours.length
          ? pending.slice(startHours.length).map((t) => ({ task: t.name, reason: 'Saved for another day to keep today realistic.' }))
          : [],
        advice: 'Plan built from your tasks. Start with the first block.',
      };
    }

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
