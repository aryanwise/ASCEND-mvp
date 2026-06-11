import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, type GroqMsg } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, messages, sessionId, sessionTitle } = await req.json();
    if (!userId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = supabaseAdmin();

    const [{ data: profile }, { data: goals }, { data: memory }] = await Promise.all([
      db.from('profiles').select('first_name, archetype').eq('id', userId).maybeSingle(),
      db.from('goals').select('title, area, duration, status, completion_pct').eq('user_id', userId).eq('status', 'active'),
      db.from('user_memory').select('key, value').eq('user_id', userId),
    ]);

    const goalLines = (goals || [])
      .map((g) => `- ${g.title} (${g.area}, ${g.duration || 'ongoing'}, ${g.completion_pct}% complete)`)
      .join('\n') || '- (no active goals yet)';

    const memLines = (memory || [])
      .map((m) => `- ${m.key}: ${JSON.stringify(m.value)}`)
      .join('\n') || '- (none yet)';

    const system = `You are Ascend — a sharp, warm accountability coach, not a generic chatbot. You help the user actually follow through. Be direct, concise, and human. Challenge excuses kindly. Reference their goals and what you know about them. Never lecture in long paragraphs; keep replies tight.

USER: ${profile?.first_name || 'there'} (archetype: ${profile?.archetype || 'unknown'})

ACTIVE GOALS:
${goalLines}

USER MEMORY:
${memLines}`;

    const recent: GroqMsg[] = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const reply = await groq([{ role: 'system', content: system }, ...recent], {
      temperature: 0.7,
      maxTokens: 700,
    });

    // Persist last user message + assistant reply
    const sid = sessionId || `s_${Date.now()}`;
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
    const rows = [];
    if (lastUser) rows.push({ user_id: userId, session_id: sid, session_title: sessionTitle || 'New conversation', role: 'user', content: lastUser.content });
    rows.push({ user_id: userId, session_id: sid, session_title: sessionTitle || 'New conversation', role: 'assistant', content: reply });
    await db.from('chat_logs').insert(rows);

    return NextResponse.json({ reply, sessionId: sid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
