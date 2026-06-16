import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60; // cron can run longer than user-facing routes

// Vercel Cron hits this hourly. For each user whose chosen plan-time matches the
// current hour, generate their day plan server-side (via the day-plan route's
// logic) so it's ready + a notification can fire later. Protected by CRON_SECRET.
//
// MVP-safe: if CRON isn't enabled yet, the app still generates on first open.
export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0'); // NOTE: times stored/compared in UTC for MVP
  const today = now.toISOString().slice(0, 10);

  // Find users whose plan_time hour matches now. plan_time stored as "HH:MM".
  const { data: prefs } = await db
    .from('user_memory')
    .select('user_id, value')
    .eq('key', 'plan_time');

  const due = (prefs || []).filter((p) => {
    const t = String(p.value || '');
    return t.slice(0, 2) === hh;
  });

  const origin = new URL(req.url).origin;
  let generated = 0;
  for (const p of due) {
    try {
      // Skip if a scheduled plan already exists for today.
      const { data: existing } = await db
        .from('day_plans').select('id, source').eq('user_id', p.user_id).eq('date', today).maybeSingle();
      if (existing && existing.source === 'scheduled') continue;

      await fetch(`${origin}/api/day-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: p.user_id, date: today, mode: 'quick', source: 'scheduled' }),
      });
      generated++;
    } catch { /* skip this user, continue */ }
  }

  return NextResponse.json({ ok: true, hour: hh, due: due.length, generated });
}
