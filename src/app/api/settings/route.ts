import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

const KEYS = ['persona', 'average_day', 'plan_time'];

// POST load + save. Stored in user_memory so all AI endpoints can read them.
export async function POST(req: NextRequest) {
  try {
    const { userId, action, persona, averageDay, planTime } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const db = supabaseAdmin();

    if (action === 'save') {
      const rows = [
        { user_id: userId, key: 'persona', value: persona || 'balanced', updated_at: new Date().toISOString() },
        { user_id: userId, key: 'average_day', value: averageDay || '', updated_at: new Date().toISOString() },
      ];
      // plan_time is optional on save (only sent when changed). "HH:MM" string.
      if (typeof planTime === 'string' && /^\d{2}:\d{2}$/.test(planTime)) {
        rows.push({ user_id: userId, key: 'plan_time', value: planTime, updated_at: new Date().toISOString() });
      }
      const { error } = await db.from('user_memory').upsert(rows, { onConflict: 'user_id,key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { data } = await db.from('user_memory').select('key, value').eq('user_id', userId).in('key', KEYS);
    const map: Record<string, unknown> = {};
    (data || []).forEach((r) => { map[r.key] = r.value; });
    return NextResponse.json({
      persona: (map.persona as string) || 'balanced',
      averageDay: (map.average_day as string) || '',
      planTime: (map.plan_time as string) || '07:00',
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
