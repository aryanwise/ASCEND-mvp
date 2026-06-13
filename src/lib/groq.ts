// Groq chat helper. Always uses llama-3.3-70b-versatile to stay under Vercel timeout.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export interface GroqMsg { role: 'system' | 'user' | 'assistant'; content: string; }

export async function groq(
  messages: GroqMsg[],
  opts: { temperature?: number; json?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    // Loud, specific failure instead of a silent empty response.
    throw new Error('GROQ_API_KEY is not set in this environment. Add it to .env.local (local) and Vercel → Settings → Environment Variables, then redeploy.');
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1200,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Safely parse JSON the model returns, stripping code fences if present.
export function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

// Shared persona definitions. Every AI surface (coach, day-plan, recalibration,
// notifications) injects the matching tone so the voice is consistent.
export type Persona = 'drill_sergeant' | 'strategist' | 'balanced';

export function personaTone(p: string | undefined): string {
  switch (p) {
    case 'drill_sergeant':
      return 'TONE: Drill Sergeant. Blunt, intense, zero excuses. Short punchy sentences. Push hard, demand action, no coddling — but never cruel or abusive. You respect them enough to be direct.';
    case 'strategist':
      return 'TONE: Strategist. Calm, analytical, planning-focused. Frame things in terms of systems, tradeoffs, and the smart next move. Measured and precise, like a sharp consultant.';
    case 'balanced':
    default:
      return 'TONE: Balanced. Supportive but honest. Warm and encouraging, yet willing to tell hard truths kindly. A great coach who has your back and still holds you accountable.';
  }
}
