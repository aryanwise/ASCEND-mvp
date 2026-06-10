import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { userId, firstName, lastName, age, archetype } = await req.json();
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .upsert({ id: userId, first_name: firstName, last_name: lastName, age: age ?? null, archetype: archetype ?? null, onboarded: false }, { onConflict: 'id' })
    .select().single();

  if (error) { console.error('Profile error:', error); return NextResponse.json({ error: error.message }, { status: 500 }); }
  return NextResponse.json({ profile: data });
}
