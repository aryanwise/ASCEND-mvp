import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';
import { loadMemory } from '@/lib/memory';
import { computeGoalPacing } from '@/lib/pacing';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Weekly review for a user's active goals. For each goal: tally last week's
// done / deferred / missed, then ask the AI whether to SLIP the deadline,
// COMPRESS remaining work, or stay on track. Updates target_date + logs the
// decision. Called per-goal to stay under the time limit (loop client/cron side
// if multiple goals). body: { userId, goalId }
export async function POST(req: NextRequest) {
  try {
    const { userId, goalId } = await req.json();
    if (!userId || !goalId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const db = supabaseAdmin();

    const { data: goal } = await db
      .from('goals')
      .select('id, title, area, target_date, start_date, duration_weeks, tasks(id, name)')
      .eq('id', goalId).maybeSingle();
    if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 404 });

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString().slice(0, 10);
    const weekStart = weekAgoISO;

    const taskIds = ((goal.tasks as { id: string }[]) || []).map((t) => t.id);

    const [{ data: checks }, { count: deferredCount }, mem, pacing] = await Promise.all([
      taskIds.length
        ? db.from('daily_check_ins').select('completed, skip_reason').in('task_id', taskIds).gte('date', weekAgoISO)
        : Promise.resolve({ data: [] as { completed: boolean; skip_reason: string | null }[] }),
      db.from('deferred_tasks').select('id', { count: 'exact', head: true }).eq('goal_id', goalId).eq('status', 'pending'),
      loadMemory(db, userId),
      computeGoalPacing(db, userId, goal),
    ]);

    const done = (checks || []).filter((c) => c.completed).length;
    const missed = (checks || []).filter((c) => !c.completed).length;
    const deferred = deferredCount || 0;
    const skipReasons = Array.from(new Set((checks || []).filter((c) => !c.completed && c.skip_reason).map((c) => c.skip_reason))).slice(0, 5);

    let decision = 'on_track';
    let newTarget = goal.target_date as string | null;
    let aiNote = '';

    // Only bother the AI if there's slippage; otherwise it's on track.
    if (deferred > 0 || missed > 0 || pacing.pct < 90) {
      try {
        const raw = await groq(
          [
            {
              role: 'system',
              content:
                'You are Ascend\'s goal strategist doing a weekly review. Given a goal\'s pace and last week\'s activity, decide ONE: "slip_deadline" (move the end date later because the plan was too ambitious for their real life), "compress" (keep the deadline, tighten remaining work — only if they have capacity), or "on_track". ' +
                'Prefer slipping the deadline when blockers are real-life constraints (tiredness, no time, work) rather than laziness. Be realistic and kind. ' +
                'Return STRICT JSON: {"decision":"slip_deadline|compress|on_track","weeks_delta":0,"note":"one short sentence to the user explaining the change"}. weeks_delta is how many weeks to move the deadline (positive = later, used only for slip_deadline). No preamble.',
            },
            {
              role: 'user',
              content: `Goal: ${goal.title} (${goal.area})\nCurrent deadline: ${goal.target_date}\nPace: ${pacing.pct}% (done ${pacing.done} of ${pacing.expectedSoFar} expected)\nLast week — done: ${done}, missed: ${missed}, still-owed(deferred): ${deferred}\nTheir blockers: ${skipReasons.join(', ') || 'none recorded'}\nTheir why: ${mem.motivation_summary || 'n/a'}`,
            },
          ],
          { json: true, temperature: 0.4, maxTokens: 200, timeoutMs: 6000, retries: 0 }
        );
        const out = parseJSON<{ decision: string; weeks_delta: number; note: string }>(raw, { decision: 'on_track', weeks_delta: 0, note: '' });
        decision = out.decision || 'on_track';
        aiNote = out.note || '';
        if (decision === 'slip_deadline' && goal.target_date && out.weeks_delta > 0) {
          const d = new Date(goal.target_date + 'T00:00:00');
          d.setDate(d.getDate() + Math.round(out.weeks_delta) * 7);
          newTarget = d.toISOString().slice(0, 10);
          await db.from('goals').update({ target_date: newTarget }).eq('id', goalId);
        }
      } catch { /* leave on_track */ }
    }

    await db.from('weekly_reviews').upsert(
      {
        user_id: userId, goal_id: goalId, week_start: weekStart,
        done_count: done, deferred_count: deferred, missed_count: missed,
        decision, old_target: goal.target_date, new_target: newTarget, ai_note: aiNote,
      },
      { onConflict: 'goal_id,week_start' }
    );

    return NextResponse.json({ ok: true, decision, newTarget, note: aiNote, pacing });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
