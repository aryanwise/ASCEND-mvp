import { NextRequest, NextResponse } from 'next/server';
import { groq, parseJSON } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { area, goal, rephrase, previousQuestion } = await req.json();
    if (!area || !goal) {
      return NextResponse.json({ error: 'Missing area or goal' }, { status: 400 });
    }

    if (rephrase && previousQuestion) {
      const raw = await groq(
        [
          { role: 'system', content: 'You are a concise goal coach. Rephrase the given question more simply and concretely so it is easy to answer. Return JSON: {"question":"..."}. No preamble.' },
          { role: 'user', content: `Area: ${area}\nGoal: ${goal}\nRephrase this question more simply: "${previousQuestion}"` },
        ],
        { json: true, temperature: 0.5, maxTokens: 300 }
      );
      const out = parseJSON<{ question: string }>(raw, { question: previousQuestion });
      return NextResponse.json({ question: out.question });
    }

    const raw = await groq(
      [
        {
          role: 'system',
          content:
            'You are an elite goal coach doing intake. Given a goal area and description, write exactly 3 short, sharp questions to understand the person. Question 1: their CURRENT reality/starting point. Question 2: their TIME and schedule constraints. Question 3: PAST attempts and what went wrong. Keep each under 18 words, conversational, no jargon. Return strict JSON: {"questions":["q1","q2","q3"]}. No preamble.',
        },
        { role: 'user', content: `Area: ${area}\nGoal: ${goal}` },
      ],
      { json: true, temperature: 0.6, maxTokens: 400 }
    );

    const out = parseJSON<{ questions: string[] }>(raw, {
      questions: [
        'Where are you starting from right now with this?',
        'How much time can you realistically give this each week?',
        'Have you tried before? What got in the way?',
      ],
    });
    const questions = (out.questions || []).slice(0, 3);
    while (questions.length < 3) questions.push('Tell me more about your situation.');
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
