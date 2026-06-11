import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

// action: 'propose' -> returns AI proposal text. 'apply' -> accept + clear flag.
export async function POST(req: NextRequest) {
  try {
    const { userId, goalId, reason, action, proposal } = await req.json();
    if (!userId || !goalId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const db = supabaseAdmin();

    if (action === 'apply') {
      await db.from('recalibrations').insert({
        user_id: userId,
        task_id: null,
        reason: reason || null,
        ai_proposal: proposal || null,
        accepted: true,
      });
      await db.from('goals').update({ needs_recalibration: false }).eq('id', goalId);
      await db.from('tasks').update({ consecutive_misses: 0 }).eq('goal_id', goalId);
      return NextResponse.json({ ok: true });
    }

    // propose
    const { data: goal } = await db
      .from('goals')
      .select('title, area, duration, tasks(name, frequency, duration)')
      .eq('id', goalId)
      .single();

    const tlist = (goal as { tasks?: { name: string }[] })?.tasks || [];
    const taskStr = tlist.map((t) => `- ${t.name}`).join('\n');

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend recalibrating a stalled goal. The user kept missing tasks for the given reason. Propose a SPECIFIC, lighter, more realistic adjustment (reduce frequency, shorten duration, reschedule, or swap a task). Be concrete and encouraging, 2-3 sentences max. Return JSON: {"proposal":"..."}. No preamble.',
        },
        {
          role: 'user',
          content: `Goal: ${goal?.title} (${goal?.area})\nCurrent tasks:\n${taskStr}\nReason for missing: ${reason || 'unspecified'}`,
        },
      ],
      { json: true, temperature: 0.6, maxTokens: 350 }
    );
    const out = parseJSON<{ proposal: string }>(raw, {
      proposal: 'Let\'s cut the frequency in half this week and rebuild momentum with smaller wins.',
    });
    return NextResponse.json({ proposal: out.proposal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
