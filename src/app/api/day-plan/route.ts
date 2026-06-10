import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '@/lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COLORS: Record<string,{color:string;soft:string}> = {
  fitness: {color:'#1B7A5C',soft:'#D9F0E5'}, study:  {color:'#3D4D8A',soft:'#E8EBF8'},
  career:  {color:'#7B4FBF',soft:'#EFE8FA'}, diet:   {color:'#B8721C',soft:'#F8E6CB'},
  mind:    {color:'#1B6B7A',soft:'#D9EEF0'}, money:  {color:'#2E7D32',soft:'#D9F0DB'},
  health:  {color:'#C62828',soft:'#FDDEDE'}, habits: {color:'#D9531E',soft:'#FFE9DD'},
  custom:  {color:'#6B6359',soft:'#EBE5D6'},
};

export async function POST(req: NextRequest) {
  const { userId, goals, context, hours } = await req.json();

  const goalList = (goals as {title:string;area:string;tasks:string[]}[]).map(g => `[${g.area}] ${g.title}: ${g.tasks.join(', ')}`).join('\n');

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 900,
    messages: [
      { role:'system', content:`Build a realistic time-blocked day plan.
GOALS:\n${goalList}
CONTEXT: ${context}
HOURS: ${hours}
Return ONLY valid JSON:
{"advice":"one sentence","blocks":[{"time":"09:00","task":"name","duration":"45 min","area":"fitness"}],"deferred":[{"task":"name","reason":"why"}]}
Rules: Start at 08:00. Be honest about capacity. Include 15min breaks. Heavy work in high-energy slots.` },
      { role:'user', content:'Generate my day plan.' },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  try {
    const data = JSON.parse(raw.replace(/```json|```/g,'').trim());
    const blocks = (data.blocks ?? []).map((b:{time:string;task:string;duration:string;area:string}) => ({
      ...b, ...COLORS[b.area] ?? COLORS.custom, done: false,
    }));
    const plan = { ...data, blocks };

    if (userId) {
      const admin = supabaseAdmin();
      const today = new Date().toISOString().split('T')[0];
      await admin.from('day_plans').upsert({ user_id:userId, date:today, ...plan, blocks, deferred:plan.deferred }, { onConflict:'user_id,date' });
    }

    return NextResponse.json(plan);
  } catch {
    return NextResponse.json({ advice:'Focus on your highest-priority tasks.', blocks:[], deferred:[] });
  }
}
