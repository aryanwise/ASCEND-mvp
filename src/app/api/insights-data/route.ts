import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, since } = await req.json();
    if (!userId || !since) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = supabaseAdmin();
    const [checkins, goals] = await Promise.all([
      db.from('daily_check_ins').select('date, completed').eq('user_id', userId).gte('date', since),
      db.from('goals').select('*').eq('user_id', userId).eq('status', 'active'),
    ]);

    return NextResponse.json({
      checkins: checkins.data || [],
      goals: goals.data || [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
