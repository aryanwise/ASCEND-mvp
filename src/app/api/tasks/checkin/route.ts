import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { distillCheckins } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, taskId, date, completed, skipReason } = await req.json();
    if (!userId || !taskId || !date) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const db = supabaseAdmin();

    // Upsert the check-in
    await db.from('daily_check_ins').upsert(
      { user_id: userId, task_id: taskId, date, completed: !!completed, skip_reason: skipReason || null },
      { onConflict: 'user_id,task_id,date' }
    );

    const { data: task } = await db
      .from('tasks')
      .select('id, goal_id, consecutive_misses')
      .eq('id', taskId)
      .single();
    if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });

    let misses = task.consecutive_misses || 0;
    if (completed) {
      misses = 0;
      await db.from('tasks').update({ consecutive_misses: 0, last_completed_at: new Date().toISOString() }).eq('id', taskId);
    } else if (skipReason) {
      misses = misses + 1;
      await db.from('tasks').update({ consecutive_misses: misses }).eq('id', taskId);
    }

    // TWO-STRIKE RULE
    let needsRecalibration = false;
    if (misses >= 2) {
      needsRecalibration = true;
      await db.from('goals').update({ needs_recalibration: true }).eq('id', task.goal_id);
    }

    // Recompute goal completion %
    const { data: goalTasks } = await db.from('tasks').select('id').eq('goal_id', task.goal_id);
    const taskIds = (goalTasks || []).map((t) => t.id);
    if (taskIds.length) {
      const { data: dones } = await db
        .from('daily_check_ins')
        .select('task_id, completed')
        .in('task_id', taskIds)
        .eq('date', date);
      const doneCount = (dones || []).filter((d) => d.completed).length;
      const pct = Math.round((doneCount / taskIds.length) * 100);
      await db.from('goals').update({ completion_pct: pct }).eq('id', task.goal_id);
    }

    // Update behavioral memory from recent check-ins (fire-and-forget, capped, never throws).
    await distillCheckins(db, userId);

    return NextResponse.json({ ok: true, misses, needsRecalibration, goalId: task.goal_id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
