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
    const [profile, priorities, plan] = await Promise.all([
      db.from('profiles').select('first_name').eq('id', userId).maybeSingle(),
      db.from('priorities').select('*').eq('user_id', userId).eq('date', date).order('id'),
      db.from('day_plans').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    ]);

    return NextResponse.json({
      firstName: profile.data?.first_name || '',
      priorities: priorities.data || [],
      dayPlan: plan.data || null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
