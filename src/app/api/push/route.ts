import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId, endpoint, p256dh, auth } = await req.json();
  const admin = supabaseAdmin();
  await admin.from('push_subscriptions').upsert({ user_id:userId, endpoint, p256dh, auth }, { onConflict:'endpoint' });
  return NextResponse.json({ ok:true });
}
