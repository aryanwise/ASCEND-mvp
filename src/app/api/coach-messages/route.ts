import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId } = await req.json();
    if (!userId || !sessionId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('chat_logs')
      .select('role, content')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
