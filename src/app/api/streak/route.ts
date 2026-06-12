import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Computes the current streak: consecutive days (ending today or yesterday) on
// which the user completed at least one check-in. A full missed day breaks it.
// Returns { streak, completedToday }.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const db = supabaseAdmin();
    // Look back up to 90 days of completed check-ins.
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await db
      .from('daily_check_ins')
      .select('date, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', since);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Set of YYYY-MM-DD strings that had at least one completion.
    const days = new Set<string>((data || []).map((r) => r.date));

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const todayStr = iso(today);
    const completedToday = days.has(todayStr);

    // Start counting from today if done today, else from yesterday (so an
    // in-progress day that's not done yet doesn't show a broken streak).
    let streak = 0;
    const cursor = new Date(today);
    if (!completedToday) cursor.setDate(cursor.getDate() - 1);

    // Walk backwards while each day has a completion.
    for (let i = 0; i < 90; i++) {
      if (days.has(iso(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return NextResponse.json({ streak, completedToday });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
