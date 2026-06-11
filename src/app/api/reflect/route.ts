import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, blockers, note } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const blockerStr = Array.isArray(blockers) ? blockers.join(', ') : '';
    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are Ascend. The user is reflecting on what blocked them. Give an honest, kind reframe — name the real pattern, then one actionable shift. 2-3 sentences. No toxic positivity, no lecturing. Return JSON: {"insight":"..."}. No preamble.',
        },
        { role: 'user', content: `Blockers: ${blockerStr || 'none selected'}\nNote: ${note || 'none'}` },
      ],
      { json: true, temperature: 0.7, maxTokens: 350 }
    );
    const out = parseJSON<{ insight: string }>(raw, {
      insight: 'The blocker is real, but it\'s usually smaller than it feels in the moment. Pick the tiniest next step and just start there.',
    });

    const db = supabaseAdmin();
    await db.from('recalibrations').insert({
      user_id: userId,
      task_id: null,
      reason: `${blockerStr}${note ? ' | ' + note : ''}`,
      ai_proposal: out.insight,
      accepted: false,
    });

    return NextResponse.json({ insight: out.insight });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
