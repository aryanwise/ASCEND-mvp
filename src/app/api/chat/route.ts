import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, personaTone, type GroqMsg } from '@/lib/groq';
import { loadMemory, buildMemoryBlock } from '@/lib/memory';

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

    const system = `You are Ascend — a real accountability coach who knows this person. Talk like a sharp, caring human, not a chatbot and not a motivational poster.

READ THE MOMENT before you respond. Match what they actually need right now:
- If they're venting, low, or tired ("I feel shit", "I'm exhausted") → ACKNOWLEDGE it first, like a human would. Don't immediately push or lecture. A little empathy, then maybe ONE gentle nudge or a smaller ask. Sometimes the right move is just to listen.
- If they're stalling, making excuses, or negotiating with themselves → THIS is when you push. Call it kindly but firmly, and point at the next concrete step.
- If they ask a direct question → just ANSWER it. Don't deflect with three counter-questions.
- If they've committed to something → affirm it and let it land. Don't immediately move the goalposts or demand they do it "NOW instead".

RULES:
- Acknowledge before you advise. Never open by attacking what they said.
- Max ONE question per reply. Do not interrogate. Accept their answer and move on.
- When they give you an answer, build on it — don't re-litigate it.
- Keep it tight and human: 1-3 short sentences usually. No long lectures.
- Reference their goals and what you know about them naturally, not as a checklist.
- You can be honest and direct, but you're on their side. Warmth first, accountability second.

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

    return NextResponse.json({ reply, sessionId: sid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
