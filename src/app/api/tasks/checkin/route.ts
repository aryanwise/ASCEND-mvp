import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId, taskId, date, completed, skipReason } = await req.json();
  const admin = supabaseAdmin();

  await admin.from('daily_check_ins').upsert({ user_id:userId, task_id:taskId, date, completed, skip_reason:skipReason??null }, { onConflict:'user_id,task_id,date' });

  if (!completed) {
    const { data: task } = await admin.from('tasks').select('consecutive_misses,goal_id').eq('id',taskId).single();
    const misses = (task?.consecutive_misses??0) + 1;
    await admin.from('tasks').update({ consecutive_misses:misses }).eq('id',taskId);
    if (misses >= 2 && task?.goal_id) {
      await admin.from('goals').update({ needs_recalibration:true }).eq('id',task.goal_id);
    }
  } else {
    await admin.from('tasks').update({ consecutive_misses:0, last_completed_at:new Date().toISOString() }).eq('id',taskId);
  }

  return NextResponse.json({ ok:true });
}
