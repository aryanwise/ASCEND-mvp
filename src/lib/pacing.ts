// Honest, activity-based completion math. A goal's completion is NOT "did you
// tick today's boxes" — it's "are you keeping pace with what this goal expects of
// you by now". Deferred + missed work counts against you; it never hits 100% on
// day one and only reaches 100% when the goal's full expected work is done.
//
// expected-so-far = sum over tasks of (per_week * weeks_elapsed)
// done            = count of completed check-ins for the goal's tasks
// pct             = clamp(round(done / expected * 100), 0, 100)
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GoalPacing {
  goalId: string;
  expectedSoFar: number;
  done: number;
  pct: number;
  pendingDeferred: number;
  onPace: boolean;
}

function weeksBetween(startISO: string, end: Date): number {
  const start = new Date(startISO + 'T00:00:00');
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60 * 24 * 7);
}

// Compute pacing for one goal. Reads its tasks (per_week), check-ins (done count),
// and pending deferred count. Caps weeks_elapsed at the goal's duration so a goal
// past its deadline expects its FULL amount (not more).
export async function computeGoalPacing(
  db: SupabaseClient, userId: string, goal: { id: string; start_date?: string; duration_weeks?: number | null }
): Promise<GoalPacing> {
  const startISO = goal.start_date || new Date().toISOString().slice(0, 10);
  const elapsedRaw = weeksBetween(startISO, new Date());
  const cap = goal.duration_weeks && goal.duration_weeks > 0 ? goal.duration_weeks : Infinity;
  // At least a fraction of week 1 so brand-new goals don't divide by zero.
  const weeksElapsed = Math.min(Math.max(elapsedRaw, 1 / 7), cap);

  const [{ data: tasks }, { data: checkins }, { count: deferredCount }] = await Promise.all([
    db.from('tasks').select('id, per_week').eq('goal_id', goal.id),
    db.from('daily_check_ins').select('task_id, completed, tasks!inner(goal_id)').eq('user_id', userId).eq('completed', true).eq('tasks.goal_id', goal.id),
    db.from('deferred_tasks').select('id', { count: 'exact', head: true }).eq('goal_id', goal.id).eq('status', 'pending'),
  ]);

  const perWeekTotal = (tasks || []).reduce((s, t) => s + (t.per_week || 1), 0);
  const expectedSoFar = Math.max(1, Math.round(perWeekTotal * weeksElapsed));
  const done = (checkins || []).length;
  const pct = Math.min(100, Math.max(0, Math.round((done / expectedSoFar) * 100)));
  const pendingDeferred = deferredCount || 0;

  return {
    goalId: goal.id,
    expectedSoFar,
    done,
    pct,
    pendingDeferred,
    // "On pace" if within ~10% of expected. Deferred pending work pulls you off pace.
    onPace: done >= expectedSoFar * 0.9 && pendingDeferred === 0,
  };
}

// Recompute + persist completion_pct for a goal. Called after check-ins/defers.
export async function refreshGoalCompletion(
  db: SupabaseClient, userId: string, goalId: string
): Promise<number> {
  const { data: goal } = await db
    .from('goals').select('id, start_date, duration_weeks').eq('id', goalId).maybeSingle();
  if (!goal) return 0;
  const pacing = await computeGoalPacing(db, userId, goal);
  await db.from('goals').update({ completion_pct: pacing.pct }).eq('id', goalId);
  return pacing.pct;
}
