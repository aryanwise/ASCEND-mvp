// Per-session chat metadata (AI title, custom rename, pinned) stored as a single
// JSON blob in user_memory under key 'chat_sessions'. Keeping it out of chat_logs
// (which is one row per message) avoids a schema change and keeps session state
// in one place. Map shape: { [sessionId]: { title, custom, pinned } }
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionMeta {
  title?: string;    // AI-generated title
  custom?: string;   // user rename (wins over title)
  pinned?: boolean;
}
export type SessionMetaMap = Record<string, SessionMeta>;

const KEY = 'chat_sessions';

export async function loadSessionMeta(db: SupabaseClient, userId: string): Promise<SessionMetaMap> {
  const { data } = await db
    .from('user_memory')
    .select('value')
    .eq('user_id', userId)
    .eq('key', KEY)
    .maybeSingle();
  return (data?.value as SessionMetaMap) || {};
}

export async function saveSessionMeta(db: SupabaseClient, userId: string, map: SessionMetaMap): Promise<void> {
  await db.from('user_memory').upsert(
    { user_id: userId, key: KEY, value: map, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

// Merge a single session's metadata fields.
export async function updateSessionMeta(
  db: SupabaseClient, userId: string, sessionId: string, patch: SessionMeta
): Promise<SessionMetaMap> {
  const map = await loadSessionMeta(db, userId);
  map[sessionId] = { ...(map[sessionId] || {}), ...patch };
  await saveSessionMeta(db, userId, map);
  return map;
}

// The label to show: custom rename > AI title > fallback.
export function sessionLabel(meta: SessionMeta | undefined, fallback: string): string {
  return (meta?.custom?.trim() || meta?.title?.trim() || fallback || 'New conversation');
}
