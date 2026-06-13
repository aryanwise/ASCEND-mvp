import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone } from '@/lib/groq';

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
    const [{ data: goal }, { data: memory }] = await Promise.all([
      db.from('goals').select('title, area, duration, tasks(name, frequency, duration, consecutive_misses)').eq('id', goalId).single(),
      db.from('user_memory').select('key, value').eq('user_id', userId).in('key', ['persona', 'average_day']),
    ]);

    const memMap: Record<string, unknown> = {};
    (memory || []).forEach((m) => { memMap[m.key] = m.value; });
    const persona = (memMap.persona as string) || 'balanced';
    const averageDay = (memMap.average_day as string) || '';

    const tlist = (goal as { tasks?: { name: string; frequency?: string; consecutive_misses?: number }[] })?.tasks || [];
    const taskStr = tlist.map((t) => `- ${t.name} (${t.frequency || ''}${(t.consecutive_misses || 0) >= 2 ? ', MISSED 2× in a row' : ''})`).join('\n');
    const missedTask = tlist.find((t) => (t.consecutive_misses || 0) >= 2);

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend running the Two-Strike Rule: the user missed the same task twice, so you stop and recalibrate — no guilt, just a real change. Look at WHY (the reason + their typical day) and propose a concrete, specific adjustment: move it to a better time, cut the frequency/duration, swap it, or pause it for the week. Offer it as a clear choice when natural. Be specific about times if their schedule suggests a better slot. 2-3 sentences max. Examples of the vibe: "Mornings aren\'t working — move this to evenings, or pause it for the week?" / "Three days a week is too much right now. Let\'s drop to two and rebuild." Return JSON: {"proposal":"..."}. No preamble.'
            + `\n\n${personaTone(persona)}`,
        },
        {
          role: 'user',
          content: `Goal: ${goal?.title} (${goal?.area})\n${averageDay ? `Their typical day: ${averageDay}\n` : ''}Current tasks:\n${taskStr}\n${missedTask ? `The repeatedly-missed task: "${missedTask.name}"\n` : ''}Reason for missing: ${reason || 'unspecified'}`,
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
