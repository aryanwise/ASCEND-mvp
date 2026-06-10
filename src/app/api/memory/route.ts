import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '@/lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { userId, conversation } = await req.json();

  const text = (conversation as {role:string;content:string}[]).map(m=>`${m.role}: ${m.content}`).join('\n');

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role:'system', content:`Extract key facts from this conversation for long-term memory.
Return ONLY valid JSON object with any of these keys that are mentioned:
{"top_skip_reasons":["..."],"strongest_days":["..."],"learning_style":"...","morning_person":true/false,"motivation_summary":"...","goal_history":["..."]}
Only include keys that were actually discussed. Return {} if nothing useful.` },
      { role:'user', content: text },
    ],
  });

  try {
    const raw = res.choices[0]?.message?.content ?? '{}';
    const facts = JSON.parse(raw.replace(/```json|```/g,'').trim());
    const admin = supabaseAdmin();
    for (const [key, value] of Object.entries(facts)) {
      if (value !== null && value !== undefined) {
        await admin.from('user_memory').upsert({ user_id:userId, key, value, updated_at:new Date().toISOString() }, { onConflict:'user_id,key' });
      }
    }
    return NextResponse.json({ ok:true, memory:Object.entries(facts).map(([k,v])=>`- ${k}: ${JSON.stringify(v)}`).join('\n') });
  } catch {
    return NextResponse.json({ ok:false });
  }
}
