import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq } from '@/lib/groq';
import { loadSessionMeta, saveSessionMeta, sessionLabel, type SessionMetaMap } from '@/lib/chatSessions';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Returns chat sessions for the sidebar: pinned first, then most recent. Lazily
// generates a short AI title for sessions that don't have one yet.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('chat_logs')
      .select('session_id, session_title, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group rows by session, preserving first-seen order + first user message.
    const order: string[] = [];
    const firstMsg: Record<string, string> = {};
    const lastAt: Record<string, string> = {};
    const fallbackTitle: Record<string, string> = {};
    (data || []).forEach((r) => {
      if (!order.includes(r.session_id)) order.push(r.session_id);
      if (r.role === 'user' && !firstMsg[r.session_id]) firstMsg[r.session_id] = r.content;
      fallbackTitle[r.session_id] = fallbackTitle[r.session_id] || r.session_title || 'New conversation';
      lastAt[r.session_id] = r.created_at;
    });

    const meta: SessionMetaMap = await loadSessionMeta(db, userId);

    // Lazily title untitled sessions (cap at 3 per load to stay fast).
    let generated = 0;
    for (const sid of order) {
      const m = meta[sid];
      const hasLabel = m?.custom || m?.title;
      if (!hasLabel && firstMsg[sid] && generated < 3) {
        try {
          const raw = await groq(
            [
              { role: 'system', content: 'Give a SHORT 2-5 word title for this chat, like a thread name. No quotes, no period, just the title.' },
              { role: 'user', content: firstMsg[sid].slice(0, 300) },
            ],
            { temperature: 0.3, maxTokens: 20, timeoutMs: 4000, retries: 0 }
          );
          const title = raw.replace(/["'.]/g, '').trim().slice(0, 48);
          if (title) {
            meta[sid] = { ...(meta[sid] || {}), title };
            generated++;
          }
        } catch { /* leave untitled, try next load */ }
      }
    }
    if (generated > 0) await saveSessionMeta(db, userId, meta);

    const sessions = order.map((sid) => ({
      session_id: sid,
      session_title: sessionLabel(meta[sid], fallbackTitle[sid]),
      pinned: !!meta[sid]?.pinned,
      last_at: lastAt[sid],
    }));

    // Pinned first, then most recent.
    sessions.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.last_at || '').localeCompare(a.last_at || '');
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
