import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface PlanTask { name: string; frequency: string; duration: string; }
interface Plan { title: string; duration: string; tasks: PlanTask[]; summary: string; }

export async function POST(req: NextRequest) {
  try {
    const { userId, area, goal, dialogue, contextSummary, motivation, archetype, markOnboarded } = await req.json();
    if (!userId || !area || !goal) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Support both the new conversational summary and the legacy Q&A array.
    const qa = contextSummary
      ? String(contextSummary)
      : Array.isArray(dialogue)
      ? dialogue.map((d: { q: string; a: string }) => `Q: ${d.q}\nA: ${d.a}`).join('\n\n')
      : '';

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend, an elite goal architect. Turn the user\'s goal + context into a concrete plan with 3-5 recurring tasks. Account for their archetype/schedule and past failures. Tasks must be specific and doable. Return STRICT JSON: {"title":"short goal title","duration":"e.g. 12 weeks","summary":"one motivating sentence","tasks":[{"name":"...","frequency":"e.g. 3x/week","duration":"e.g. 30 min"}]}. 3-5 tasks. No preamble.',
        },
        {
          role: 'user',
          content: `Area: ${area}\nGoal: ${goal}\nArchetype: ${archetype || 'unknown'}\nMotivation: ${motivation || 'n/a'}\n\nIntake conversation summary:\n${qa}`,
        },
      ],
      { json: true, temperature: 0.6, maxTokens: 900 }
    );

    const plan = parseJSON<Plan>(raw, {
      title: goal.slice(0, 60),
      duration: '8 weeks',
      summary: 'A focused plan to move you forward.',
      tasks: [
        { name: 'Take one concrete action toward the goal', frequency: 'Daily', duration: '20 min' },
        { name: 'Review progress and adjust', frequency: 'Weekly', duration: '15 min' },
      ],
    });

    const db = supabaseAdmin();

    const { data: goalRow, error: gErr } = await db
      .from('goals')
      .insert({
        user_id: userId,
        title: plan.title || goal.slice(0, 60),
        area,
        duration: plan.duration || null,
        motivation: motivation || null,
        plan_json: plan,
      })
      .select()
      .single();
    if (gErr || !goalRow) return NextResponse.json({ error: gErr?.message || 'insert failed' }, { status: 500 });

    const tasks = (plan.tasks || []).slice(0, 6).map((t) => ({
      goal_id: goalRow.id,
      user_id: userId,
      name: t.name,
      frequency: t.frequency || null,
      duration: t.duration || null,
    }));
    if (tasks.length) {
      const { error: tErr } = await db.from('tasks').insert(tasks);
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    if (markOnboarded) {
      await db.from('profiles').update({ onboarded: true }).eq('id', userId);
    }

    return NextResponse.json({ ok: true, goal: goalRow });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
