import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Returns distinct chat sessions (most recent first) for the sidebar.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('chat_logs')
      .select('session_id, session_title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const seen = new Set<string>();
    const sessions: { session_id: string; session_title: string }[] = [];
    (data || []).forEach((r) => {
      if (!seen.has(r.session_id)) {
        seen.add(r.session_id);
        sessions.push({ session_id: r.session_id, session_title: r.session_title });
      }
    });
    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
