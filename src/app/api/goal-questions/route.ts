import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { area, goalText, rephrase, previousQuestion } = await req.json();

  const system = rephrase
    ? `The user didn't understand this question: "${previousQuestion}". Rephrase it from a completely different angle. Give a concrete example specific to ${area}. Return ONLY a JSON array with one question: ["rephrased question"]`
    : `Generate exactly 3 questions to understand this ${area} goal: "${goalText}".
- Question 1: current reality and honest constraints
- Question 2: time and schedule availability  
- Question 3: past attempts — what worked briefly, what broke it
Max 20 words each. Return ONLY a JSON array: ["q1", "q2", "q3"]`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: rephrase ? 'Rephrase it.' : `Area: ${area}\nGoal: ${goalText}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '[]';
  try {
    const questions = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({
      questions: rephrase
        ? ["Let's try differently — what does your typical week look like right now?"]
        : [
            "What's your honest starting point right now?",
            "How many hours per week can you realistically commit?",
            "You've tried this before — what made it fall apart?",
          ],
    });
  }
}