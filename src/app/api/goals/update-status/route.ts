import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  try {
    const { goalId, status } = await req.json();
    if (!goalId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const db = supabaseAdmin();
    const { error } = await db.from('goals').update({ status }).eq('id', goalId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
