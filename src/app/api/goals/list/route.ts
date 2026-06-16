import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Lists the user's goals (with tasks) using the service role, bypassing RLS.
// A direct client read can return empty if the auth token isn't attached yet
// right after navigation/login — same race that affected the auth pages.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('goals')
      .select('*, tasks(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Attach pending deferred (rollover) count per goal so the UI can surface it.
    const goals = data || [];
    if (goals.length) {
      const { data: defs } = await db
        .from('deferred_tasks')
        .select('goal_id')
        .eq('user_id', userId)
        .eq('status', 'pending');
      const counts: Record<string, number> = {};
      (defs || []).forEach((d) => { counts[d.goal_id] = (counts[d.goal_id] || 0) + 1; });
      goals.forEach((g: { id: string; deferred_count?: number }) => { g.deferred_count = counts[g.id] || 0; });
    }
    return NextResponse.json({ goals });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
