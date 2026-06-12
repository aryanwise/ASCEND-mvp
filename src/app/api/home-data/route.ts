import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Loads everything the Home screen needs in one call, via service role,
// bypassing the RLS token race on first paint.
export async function POST(req: NextRequest) {
  try {
    const { userId, date } = await req.json();
    if (!userId || !date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = supabaseAdmin();
    const [profile, priorities, plan, checkins] = await Promise.all([
      db.from('profiles').select('first_name').eq('id', userId).maybeSingle(),
      db.from('priorities').select('*').eq('user_id', userId).eq('date', date).order('id'),
      db.from('day_plans').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
      db.from('daily_check_ins').select('date').eq('user_id', userId).eq('completed', true)
        .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)),
    ]);

    // Compute streak inline (consecutive completed days ending today/yesterday).
    const days = new Set<string>((checkins.data || []).map((r) => r.date));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const completedToday = days.has(iso(today));
    let streak = 0;
    const cursor = new Date(today);
    if (!completedToday) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 90; i++) {
      if (days.has(iso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }

    return NextResponse.json({
      firstName: profile.data?.first_name || '',
      priorities: priorities.data || [],
      dayPlan: plan.data || null,
      streak,
      completedToday,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
