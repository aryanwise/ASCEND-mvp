import { NextRequest, NextResponse } from 'next/server';
import { groq, parseJSON, type GroqMsg } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface Turn { role: 'assistant' | 'user'; content: string; }
interface Out {
  message: string;
  done: boolean;
  context_summary?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { area, goal, firstName, history } = await req.json();
    if (!area || !goal) {
      return NextResponse.json({ error: 'Missing area or goal' }, { status: 400 });
    }

    const turns: Turn[] = Array.isArray(history) ? history : [];
    const userTurns = turns.filter((t) => t.role === 'user').length;

    const system = `You are Ascend, a warm, sharp goal coach doing a quick intake conversation. The user wants to achieve a goal and you're getting to know their situation so you can build a realistic plan.

GOAL AREA: ${area}
THEIR GOAL: "${goal}"
${firstName ? `THEIR NAME: ${firstName}` : ''}

Your job over a few short messages: understand (1) their current starting point, (2) their real schedule and time constraints, and (3) what they've tried before and what got in the way. You do NOT need to cover all three rigidly — flow naturally.

RULES:
- Ask ONE question at a time. Keep each message short (1-2 sentences), warm, and human — like texting a friend who happens to be a great coach.
- If the user seems confused, unsure, says "idk"/"not sure", or gives a vague answer, DON'T repeat the same question. Rephrase it more simply and concretely, give an example, or approach from a different angle.
- Acknowledge what they said before asking the next thing. React like a person, not a form.
- After you have enough to build a solid plan (usually 3-4 user answers), set "done": true, give a brief encouraging closing message, and write a "context_summary" capturing everything useful you learned.
- NEVER ask more than ~5 questions total. If you're at that point, wrap up.

Respond ONLY as strict JSON:
{"message": "your next message to the user", "done": false}
OR when finished:
{"message": "your warm closing line", "done": true, "context_summary": "concise summary of their situation, schedule, past attempts, and anything relevant for planning"}
No preamble, no markdown.`;

    const convo: GroqMsg[] = [{ role: 'system', content: system }];
    for (const t of turns) convo.push({ role: t.role, content: t.content });

    if (turns.length === 0) {
      convo.push({ role: 'user', content: '(Begin the intake conversation now with your first question.)' });
    }

    const forceDone = userTurns >= 5;
    if (forceDone) {
      convo.push({ role: 'user', content: '(You now have enough. Set done=true, give a short closing line, and write the context_summary.)' });
    }

    const raw = await groq(convo, { json: true, temperature: 0.7, maxTokens: 500 });
    const out = parseJSON<Out>(raw, {
      message: 'Got it — that gives me what I need to build your plan.',
      done: true,
      context_summary: `Goal: ${goal}. (Intake summary unavailable.)`,
    });

    if (forceDone) out.done = true;
    if (out.done && !out.context_summary) {
      out.context_summary = turns.map((t) => `${t.role}: ${t.content}`).join(' | ');
    }

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}