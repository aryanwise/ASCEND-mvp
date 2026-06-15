import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone, type GroqMsg } from '@/lib/groq';
import { loadMemory, buildMemoryBlock, distillCoachSession } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, messages, sessionId, sessionTitle } = await req.json();
    if (!userId || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = supabaseAdmin();

    const [{ data: profile }, { data: goals }, mem] = await Promise.all([
      db.from('profiles').select('first_name, archetype').eq('id', userId).maybeSingle(),
      db.from('goals').select('title, area, duration, status, completion_pct').eq('user_id', userId).eq('status', 'active'),
      loadMemory(db, userId),
    ]);

    const goalLines = (goals || [])
      .map((g) => `- ${g.title} (${g.area}, ${g.duration || 'ongoing'}, ${g.completion_pct}% complete)`)
      .join('\n') || '- (no active goals yet)';

    const persona = mem.persona;
    const memoryBlock = buildMemoryBlock(mem, profile?.first_name || '');

    const system = `You are Ascend — a sharp accountability coach, not a generic chatbot. You help the user actually follow through. Be concise and human. Challenge excuses. Reference their goals and what you know about them. Never lecture in long paragraphs; keep replies tight.

${personaTone(persona)}

USER: ${profile?.first_name || 'there'} (archetype: ${profile?.archetype || 'unknown'})

ACTIVE GOALS:
${goalLines}

${memoryBlock}`;

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

    // Distill durable memory from the conversation every few user turns (capped,
    // strict, never throws). Awaited because serverless may freeze after response.
    const userTurns = messages.filter((m: { role: string }) => m.role === 'user').length;
    if (userTurns > 0 && userTurns % 6 === 0) {
      const transcript = [...messages.slice(-15), { role: 'assistant', content: reply }];
      await distillCoachSession(db, userId, transcript, groq, parseJSON);
    }

    return NextResponse.json({ reply, sessionId: sid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
