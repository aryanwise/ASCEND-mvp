import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON } from '@/lib/groq';
import { distillCoachSession } from '@/lib/memory';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Background memory distillation, decoupled from the coach reply. The client
// fires this after a chat turn; if it's slow or fails, the user's chat is
// unaffected. Always returns ok so the client never surfaces an error.
export async function POST(req: NextRequest) {
  try {
    const { userId, messages } = await req.json();
    if (!userId || !Array.isArray(messages)) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    const db = supabaseAdmin();
    await distillCoachSession(db, userId, messages.slice(-16), groq, parseJSON);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
