import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Vercel Cron hits this weekly. Runs the AI weekly review for every active goal
// (deadline slip vs compress vs on-track). Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: goals } = await db
    .from('goals').select('id, user_id').eq('status', 'active');

  const origin = new URL(req.url).origin;
  let reviewed = 0;
  for (const g of goals || []) {
    try {
      await fetch(`${origin}/api/weekly-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: g.user_id, goalId: g.id }),
      });
      reviewed++;
    } catch { /* continue */ }
  }
  return NextResponse.json({ ok: true, reviewed });
}
