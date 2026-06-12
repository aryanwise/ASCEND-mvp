import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

// LOGIN streak: counts consecutive days the user OPENED the app (ending today).
// Opening the app marks today as active (idempotent — only the date matters, not
// how many times). A full missed day breaks the streak. Active days are stored
// in user_memory under key 'active_days' as a JSON array of YYYY-MM-DD strings,
// so no schema change is needed.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const db = supabaseAdmin();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = iso(new Date());

    // Read existing active days.
    const { data: row } = await db
      .from('user_memory')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'active_days')
      .maybeSingle();

    let days: string[] = Array.isArray(row?.value) ? (row!.value as string[]) : [];

    // Mark today active (only if not already present — keeps it idempotent).
    if (!days.includes(today)) {
      days.push(today);
      // Keep the list bounded (last ~120 days is plenty for streaks).
      days = days.sort().slice(-120);
      await db.from('user_memory').upsert(
        { user_id: userId, key: 'active_days', value: days, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    }

    // Compute consecutive streak ending today.
    const set = new Set(days);
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 120; i++) {
      if (set.has(iso(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }

    return NextResponse.json({ streak });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
