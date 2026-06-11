import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const db = supabaseAdmin();

    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const [{ data: checkins }, { data: goals }, { data: memory }] = await Promise.all([
      db.from('daily_check_ins').select('date, completed').eq('user_id', userId).gte('date', since),
      db.from('goals').select('title, completion_pct, needs_recalibration').eq('user_id', userId).eq('status', 'active'),
      db.from('user_memory').select('key, value').eq('user_id', userId),
    ]);

    const total = (checkins || []).length;
    const done = (checkins || []).filter((c) => c.completed).length;
    const memStr = (memory || []).map((m) => `${m.key}: ${JSON.stringify(m.value)}`).join('; ');

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend. Write ONE sharp, specific observation (max 22 words) about the user\'s last 7 days of progress. Be honest and useful, not generic praise. Return JSON: {"observation":"..."}. No preamble.',
        },
        {
          role: 'user',
          content: `Check-ins last 7d: ${done}/${total} completed.\nGoals: ${(goals || []).map((g) => `${g.title} ${g.completion_pct}%`).join(', ')}\nMemory: ${memStr || 'none'}`,
        },
      ],
      { json: true, temperature: 0.6, maxTokens: 200 }
    );
    const out = parseJSON<{ observation: string }>(raw, {
      observation: total === 0 ? 'No check-ins yet this week — start small today and the data will follow.' : 'You\'re building a record. Keep the streak honest and the momentum will compound.',
    });
    return NextResponse.json({ observation: out.observation });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
