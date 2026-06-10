import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { supabaseAdmin } from '@/lib/supabase';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { userId, area, goalText, dialogue, motivation, archetype } = await req.json();
  const admin = supabaseAdmin();

  const qa = (dialogue as {role:string;content:string}[]).map(m => `${m.role}: ${m.content}`).join('\n');

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content: `Build a realistic goal plan from the user's answers. Archetype: ${archetype}.
Return ONLY valid JSON:
{
  "title": "goal title (5 words max)",
  "duration": "X weeks",
  "summary": "2 sentence summary",
  "tasks": [
    { "name": "task name", "frequency": "daily OR weekly:3x OR weekly:Mon,Wed,Fri", "duration": "X min" }
  ],
  "tips": ["tip1", "tip2"]
}
Rules: 2-4 tasks max. Realistic for archetype. Strip <think> tags from output.`,
      },
      { role: 'user', content: `Area: ${area}\nGoal: ${goalText}\nDialogue:\n${qa}` },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim();

  let plan: { title:string; duration:string; summary:string; tasks:{name:string;frequency:string;duration:string}[]; tips:string[] };
  try { plan = JSON.parse(text); }
  catch {
    plan = { title: goalText.slice(0,40), duration:'12 weeks', summary:'A realistic plan built for your life.', tasks:[{ name:'Daily practice', frequency:'daily', duration:'30 min' }], tips:[] };
  }

  const { data: goal } = await admin.from('goals').insert({
    user_id: userId, title: plan.title, area, duration: plan.duration,
    motivation, status: 'active', needs_recalibration: false, completion_pct: 0,
    plan_json: { summary: plan.summary, tips: plan.tips },
  }).select().single();

  if (goal) {
    await admin.from('tasks').insert(plan.tasks.map(t => ({
      goal_id: goal.id, user_id: userId,
      name: t.name, frequency: t.frequency, duration: t.duration, consecutive_misses: 0,
    })));
  }

  // Mark onboarded
  await admin.from('profiles').update({ onboarded: true }).eq('id', userId);

  return NextResponse.json({ success: true });
}
