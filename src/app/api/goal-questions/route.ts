import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { area, goalText } = await req.json();

  const system = `You are Ascend's goal discovery AI. Generate exactly 3 questions to deeply understand this goal.

Rules:
- Question 1: Current reality and constraints (be specific to what they wrote)
- Question 2: Time, schedule, and bandwidth
- Question 3: Past attempts — what worked briefly, what broke it
- Max 20 words per question. Direct. No fluff.
- If user answers "idk" or is vague: your follow-up should rephrase from a different angle with a concrete example
- Return ONLY a JSON array: ["q1", "q2", "q3"]`;

  const response = await groq.chat.completions.create({
    // model: 'deepseek-r1-distill-llama-70b',
    model: 'llama-3.3-70b-versatile',
    max_tokens: 400,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Area: ${area}\nGoal: ${goalText}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '[]';
  try {
    const clean = text.replace(/```json|```|<think>[\s\S]*?<\/think>/g, '').trim();
    const questions = JSON.parse(clean);
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({
      questions: [
        "What's your honest starting point right now — be specific?",
        "How many hours per week can you realistically commit, given your current schedule?",
        "You've probably tried something like this before — what made it fall apart?",
      ],
    });
  }
}
