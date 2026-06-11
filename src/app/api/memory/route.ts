import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

const ALLOWED = ['top_skip_reasons', 'strongest_days', 'learning_style', 'morning_person', 'motivation_summary'];

export async function POST(req: NextRequest) {
  try {
    const { userId, messages } = await req.json();
    if (!userId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const transcript = messages
      .slice(-12)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n');

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'Extract durable facts about the user from this conversation. Only include keys you have real evidence for. Allowed keys: top_skip_reasons (array of strings), strongest_days (array of weekday strings), learning_style (string), morning_person (boolean), motivation_summary (string). Return STRICT JSON with ONLY the keys you found, e.g. {"top_skip_reasons":["fatigue"],"morning_person":false}. If nothing concrete, return {}. No preamble.',
        },
        { role: 'user', content: transcript },
      ],
      { json: true, temperature: 0.2, maxTokens: 400 }
    );

    const facts = parseJSON<Record<string, unknown>>(raw, {});
    const db = supabaseAdmin();
    const rows = Object.entries(facts)
      .filter(([k]) => ALLOWED.includes(k))
      .map(([key, value]) => ({ user_id: userId, key, value, updated_at: new Date().toISOString() }));

    if (rows.length) {
      await db.from('user_memory').upsert(rows, { onConflict: 'user_id,key' });
    }

    return NextResponse.json({ ok: true, extracted: rows.map((r) => r.key) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
