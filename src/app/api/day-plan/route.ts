import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone } from '@/lib/groq';
import { loadMemory, buildSchedulingMemory } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Block { time: string; task: string; area: string; duration?: string; task_id?: string | null; }
interface Deferred { task: string; reason: string; task_id?: string | null; }
interface PlanOut { blocks: Block[]; deferred: Deferred[]; advice: string; }

interface TaskRow { id: string; name: string; frequency?: string; duration?: string; }
interface GoalRow { id: string; title: string; area: string; duration?: string; target_date?: string | null; tasks?: TaskRow[]; }

export async function POST(req: NextRequest) {
  try {
    const { userId, date, mode, energy, hours, mood, todayNote, source } = await req.json();
    if (!userId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const isTune = mode === 'tune';
    const db = supabaseAdmin();

    const [{ data: profile }, { data: goalsRaw }, mem] = await Promise.all([
      db.from('profiles').select('archetype').eq('id', userId).maybeSingle(),
      db.from('goals')
        .select('id, title, area, duration, target_date, tasks(id, name, frequency, duration)')
        .eq('user_id', userId).eq('status', 'active'),
      loadMemory(db, userId),
    ]);
    const goals = (goalsRaw || []) as GoalRow[];
    const schedulingMemory = buildSchedulingMemory(mem);

    // Map every task id -> its goal area + name, for labeling deferred rows.
    const taskMeta: Record<string, { name: string; area: string; goalId: string; duration?: string }> = {};
    const allTaskIds: string[] = [];
    goals.forEach((g) => {
      (g.tasks || []).forEach((t) => {
        taskMeta[t.id] = { name: t.name, area: g.area, goalId: g.id, duration: t.duration };
        allTaskIds.push(t.id);
      });
    });

    // Tasks already completed TODAY — never reschedule them.
    let completedTodayIds = new Set<string>();
    if (allTaskIds.length) {
      const { data: checks } = await db
        .from('daily_check_ins').select('task_id, completed')
        .in('task_id', allTaskIds).eq('date', date).eq('completed', true);
      completedTodayIds = new Set((checks || []).map((c) => c.task_id));
    }

    // Pending DEFERRED (rollover) tasks — these resurface in today's plan.
    const { data: deferredRows } = await db
      .from('deferred_tasks')
      .select('id, task_id, reason')
      .eq('user_id', userId).eq('status', 'pending');
    const rolloverIds = (deferredRows || [])
      .map((d) => d.task_id)
      .filter((id) => id && !completedTodayIds.has(id));

    // "All done" guard: nothing left to schedule today (no remaining goal tasks
    // and no rollovers). Tell the user to rest instead of inventing busywork.
    const remainingGoalTaskIds = allTaskIds.filter((id) => !completedTodayIds.has(id));
    if (remainingGoalTaskIds.length === 0 && rolloverIds.length === 0 && completedTodayIds.size > 0) {
      const donePlan = { blocks: [] as Block[], deferred: [] as Deferred[], advice: '', allDone: true };
      await db.from('day_plans').upsert(
        { user_id: userId, date, blocks: [], deferred: [], advice: 'All done for today — rest and come back tomorrow.', source: source || (isTune ? 'tuned' : 'manual'), generated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      );
      return NextResponse.json({ ...donePlan, advice: "You've finished everything for today. Rest up — let's get back at it tomorrow." });
    }

    // Build goal/task context, deadline-first. Completed-today tasks omitted.
    // Sort goals by nearest target_date so the AI prioritizes urgent deadlines.
    const sortedGoals = [...goals].sort((a, b) =>
      (a.target_date || '9999').localeCompare(b.target_date || '9999'));
    const goalCtx = sortedGoals
      .map((g) => {
        const ts = (g.tasks || [])
          .filter((t) => !completedTodayIds.has(t.id))
          .map((t) => `  • [task_id:${t.id}] ${t.name} [${g.area}] (${t.frequency || ''} ${t.duration || ''})`)
          .join('\n');
        const dl = g.target_date ? ` — deadline ${g.target_date}` : '';
        return ts ? `${g.title} (${g.area}${dl}):\n${ts}` : '';
      })
      .filter(Boolean)
      .join('\n\n') || '(no active goals with remaining tasks today)';

    // Rollover context — these were deferred earlier and are owed.
    const rolloverCtx = rolloverIds.length
      ? '\n\nCARRIED-OVER (deferred earlier, owed — prioritize clearing these):\n' +
        rolloverIds.map((id) => `  • [task_id:${id}] ${taskMeta[id]?.name || 'task'} [${taskMeta[id]?.area || 'custom'}]`).join('\n')
      : '';

    // PRIORITY DESIGN: base plan = goal deadlines + archetype (routine).
    // Tuning layers on priorities/energy/mood/hours.
    const system = (isTune
      ? "You are Ascend's day planner. PRIMARY priority: goal deadlines + the user's archetype/daily routine — fit goal work into the gaps around their real commitments, never on top of them, and favor tasks tied to nearer deadlines and carried-over (owed) tasks. THEN tune with today's energy, hours, mood, and anything specific they mentioned. If energy is low or hours are few, schedule LESS and DEFER the rest with a short honest reason. Each block needs a clock time, the task, its area key, and the task_id."
      : "You are Ascend's day planner. Build a realistic time-blocked schedule driven by goal DEADLINES and the user's archetype/daily routine — fit goal work into the gaps around their real commitments (work, classes), never on top of them. Favor nearer deadlines and carried-over (owed) tasks. Don't overload the day — DEFER what doesn't fit with a short honest reason. Each block needs a clock time, the task, its area key, and the task_id.")
      + ' Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"study","duration":"30 min","task_id":"copy the task_id in brackets, or null for one-off items"}],"deferred":[{"task":"...","reason":"...","task_id":"the task_id if it maps to a goal task, else null"}],"advice":"one sharp, warm sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.'
      + `\n\n${personaTone('balanced')} Apply this tone to the "advice" line.`;

    const userMsg = isTune
      ? `Archetype: ${profile?.archetype || 'unknown'}\n${schedulingMemory ? schedulingMemory + '\n' : ''}Energy: ${energy || 'Medium'}\nHours available: ${hours ?? 'unspecified'}\nMood: ${mood || 'neutral'}\n\nANYTHING SPECIFIC FOR TODAY (user's own words):\n${todayNote?.trim() || '(nothing extra)'}\n\nGOALS & TASKS:\n${goalCtx}${rolloverCtx}`
      : `Archetype: ${profile?.archetype || 'unknown'}\n${schedulingMemory ? schedulingMemory + '\n' : ''}\nGOALS & TASKS (plan from these and their deadlines):\n${goalCtx}${rolloverCtx}`;

    let out: PlanOut;
    try {
      const raw = await groq(
        [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
        { json: true, temperature: 0.6, maxTokens: 1100 }
      );
      out = parseJSON<PlanOut>(raw, { blocks: [], deferred: [], advice: 'Start with the most important thing first.' });
    } catch {
      out = { blocks: [], deferred: [], advice: '' };
    }

    // Fallback: simple sequential schedule from remaining + rollover tasks.
    if (!out.blocks || out.blocks.length === 0) {
      const startHours = [6, 8, 10, 13, 15, 17, 19];
      const pending: { id: string; name: string; area: string; duration?: string }[] = [];
      rolloverIds.forEach((id) => taskMeta[id] && pending.push({ id, name: taskMeta[id].name, area: taskMeta[id].area, duration: taskMeta[id].duration }));
      goals.forEach((g) => (g.tasks || []).filter((t) => !completedTodayIds.has(t.id) && !rolloverIds.includes(t.id))
        .forEach((t) => pending.push({ id: t.id, name: t.name, area: g.area, duration: t.duration })));
      out = {
        blocks: pending.slice(0, startHours.length).map((t, i) => {
          const h = startHours[i];
          const label = h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
          return { time: label, task: t.name, area: t.area, duration: t.duration || '', task_id: t.id };
        }),
        deferred: pending.slice(startHours.length).map((t) => ({ task: t.name, reason: 'Saved to keep today realistic.', task_id: t.id })),
        advice: 'Plan built from your tasks. Start with the first block.',
      };
    }

    const blocks = (out.blocks || []).map((b) => ({ ...b, done: false }));
    const deferred = (out.deferred || []);

    // --- Persist deferred tasks to deferred_tasks (the rollover ledger) ---
    // Tasks the AI scheduled today are NO LONGER pending-deferred (they got a slot);
    // tasks it deferred that map to a goal task become/stay pending.
    const scheduledTaskIds = new Set(blocks.map((b) => b.task_id).filter(Boolean) as string[]);
    // Resolve rollovers that are now scheduled (no longer just owed — they have a slot today).
    // We keep them 'pending' until actually checked off; only completion resolves them.
    // Insert new deferrals for AI-deferred goal tasks not already pending.
    const existingPending = new Set((deferredRows || []).map((d) => d.task_id).filter(Boolean) as string[]);
    const toInsert = deferred
      .map((d) => d.task_id)
      .filter((id): id is string => !!id && !!taskMeta[id] && !existingPending.has(id) && !scheduledTaskIds.has(id))
      .map((id) => ({
        user_id: userId,
        task_id: id,
        goal_id: taskMeta[id].goalId,
        origin_date: date,
        reason: deferred.find((d) => d.task_id === id)?.reason || 'Deferred to keep the day realistic.',
        status: 'pending',
      }));
    if (toInsert.length) await db.from('deferred_tasks').insert(toInsert);

    // Recompute completion for affected goals (deferrals change pacing).
    // (Done lazily here; checkin already refreshes on completion.)
    const moodStore = isTune ? ([mood, todayNote?.trim()].filter(Boolean).join(' | ') || null) : null;

    await db.from('day_plans').upsert(
      {
        user_id: userId, date,
        energy: isTune ? (energy || null) : null,
        hours_available: isTune ? (hours ?? null) : null,
        mood_context: moodStore,
        blocks,
        deferred,
        advice: out.advice || null,
        source: source || (isTune ? 'tuned' : 'manual'),
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

    return NextResponse.json({ blocks, deferred, advice: out.advice || '', allDone: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
