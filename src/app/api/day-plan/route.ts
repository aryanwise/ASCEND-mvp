import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Block { time: string; task: string; area: string; duration?: string; }
interface Deferred { task: string; reason: string; }
interface PlanOut { blocks: Block[]; deferred: Deferred[]; advice: string; }

export async function POST(req: NextRequest) {
  try {
    const { userId, date, energy, hours, mood } = await req.json();
    if (!userId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = supabaseAdmin();
    const [{ data: profile }, { data: goals }, { data: priorities }] = await Promise.all([
      db.from('profiles').select('archetype').eq('id', userId).maybeSingle(),
      db.from('goals').select('id, title, area, tasks(name, frequency, duration)').eq('user_id', userId).eq('status', 'active'),
      db.from('priorities').select('text, done').eq('user_id', userId).eq('date', date),
    ]);

    const goalCtx = (goals || [])
      .map((g) => {
        const tlist = (g as { tasks?: { name: string; frequency?: string; duration?: string }[] }).tasks || [];
        const ts = tlist.map((t) => `  • ${t.name} [${g.area}] (${t.frequency || ''} ${t.duration || ''})`).join('\n');
        return `${g.title} (${g.area}):\n${ts}`;
      })
      .join('\n\n') || '(no active goals)';

    const prioCtx = (priorities || []).filter((p) => !p.done).map((p) => `- ${p.text}`).join('\n') || '(none)';

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend\'s day planner. Build a realistic time-blocked schedule from the user\'s active goal tasks + priorities, respecting their energy, available hours, mood, and archetype. Do NOT overload them — if energy is low or hours are few, schedule less and DEFER the rest with a short honest reason. Each block needs a clock time (e.g. "9:00 AM"), the task, and its area key. Return STRICT JSON: {"blocks":[{"time":"9:00 AM","task":"...","area":"fitness","duration":"30 min"}],"deferred":[{"task":"...","reason":"..."}],"advice":"one sharp sentence"}. Area must be one of: fitness, study, career, diet, mind, money, health, habits, custom. No preamble.',
        },
        {
          role: 'user',
          content: `Archetype: ${profile?.archetype || 'unknown'}\nEnergy: ${energy || 'Medium'}\nHours available: ${hours ?? 'unspecified'}\nMood: ${mood || 'neutral'}\n\nGOALS & TASKS:\n${goalCtx}\n\nTOP PRIORITIES:\n${prioCtx}`,
        },
      ],
      { json: true, temperature: 0.6, maxTokens: 1100 }
    );

    const out = parseJSON<PlanOut>(raw, { blocks: [], deferred: [], advice: 'Start with the most important thing first.' });

    const blocks = (out.blocks || []).map((b) => ({ ...b, done: false }));

    await db.from('day_plans').upsert(
      {
        user_id: userId,
        date,
        energy: energy || null,
        hours_available: hours ?? null,
        mood_context: mood || null,
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
