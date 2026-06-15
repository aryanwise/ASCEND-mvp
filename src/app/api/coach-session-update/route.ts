import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { updateSessionMeta } from '@/lib/chatSessions';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Rename or pin/unpin a chat session. body: { userId, sessionId, custom?, pinned? }
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId, custom, pinned } = await req.json();
    if (!userId || !sessionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const db = supabaseAdmin();
    const patch: { custom?: string; pinned?: boolean } = {};
    if (typeof custom === 'string') patch.custom = custom.trim().slice(0, 60);
    if (typeof pinned === 'boolean') patch.pinned = pinned;
    await updateSessionMeta(db, userId, sessionId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
