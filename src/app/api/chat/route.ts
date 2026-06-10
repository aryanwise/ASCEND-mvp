import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { system, messages } = await req.json();
  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 500,
    messages: [{ role: 'system', content: system }, ...messages],
  });
  return NextResponse.json({ content: res.choices[0]?.message?.content ?? '' });
}
