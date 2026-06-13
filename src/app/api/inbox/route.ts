import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { groq, parseJSON, personaTone } from '@/lib/groq';

export const runtime = 'nodejs';
export const maxDuration = 10;

interface InboxItem {
  id: string;
  text: string;
  kind: string;       // 'observation' | 'suggestion' | 'nudge'
  created_at: string;
  read: boolean;
}

// action: 'list' -> return stored items
//         'generate' -> create fresh AI insights from current data, prepend, return
//         'read' -> mark all as read
export async function POST(req: NextRequest) {
  try {
    const { userId, action } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    const db = supabaseAdmin();

    const loadItems = async (): Promise<InboxItem[]> => {
      const { data } = await db.from('user_memory').select('value').eq('user_id', userId).eq('key', 'inbox').maybeSingle();
      return Array.isArray(data?.value) ? (data!.value as InboxItem[]) : [];
    };
    const saveItems = async (items: InboxItem[]) => {
      await db.from('user_memory').upsert(
        { user_id: userId, key: 'inbox', value: items.slice(0, 50), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    };

    if (action === 'read') {
      const items = (await loadItems()).map((i) => ({ ...i, read: true }));
      await saveItems(items);
      return NextResponse.json({ items });
    }

    if (action === 'generate') {
      // Gather signal: goals, recent check-ins, memory, persona.
      const [{ data: profile }, { data: goals }, { data: memory }] = await Promise.all([
        db.from('profiles').select('first_name').eq('id', userId).maybeSingle(),
        db.from('goals').select('id, title, area, completion_pct, needs_recalibration, tasks(name, consecutive_misses)').eq('user_id', userId).eq('status', 'active'),
        db.from('user_memory').select('key, value').eq('user_id', userId),
      ]);

      const memMap: Record<string, unknown> = {};
      (memory || []).forEach((m) => { memMap[m.key] = m.value; });
      const persona = (memMap.persona as string) || 'balanced';
      const averageDay = (memMap.average_day as string) || '';

      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const goalIds = (goals || []).map((g) => g.id);
      let checkSummary = '(no recent check-ins)';
      if (goalIds.length) {
        const { data: tasks } = await db.from('tasks').select('id, name').in('goal_id', goalIds);
        const taskIds = (tasks || []).map((t) => t.id);
        if (taskIds.length) {
          const { data: checks } = await db.from('daily_check_ins').select('completed, skip_reason, date').in('task_id', taskIds).gte('date', since);
          const done = (checks || []).filter((c) => c.completed).length;
          const missed = (checks || []).filter((c) => !c.completed).length;
          const reasons = (checks || []).filter((c) => c.skip_reason).map((c) => c.skip_reason);
          checkSummary = `Last 7 days: ${done} completed, ${missed} missed. Skip reasons: ${reasons.join(', ') || 'none given'}.`;
        }
      }

      const goalCtx = (goals || []).map((g) => {
        const tl = (g as { tasks?: { name: string; consecutive_misses?: number }[] }).tasks || [];
        const struggling = tl.filter((t) => (t.consecutive_misses || 0) >= 1).map((t) => t.name);
        return `${g.title} (${g.area}, ${g.completion_pct || 0}% done${g.needs_recalibration ? ', NEEDS RECALIBRATION' : ''})${struggling.length ? ` — slipping on: ${struggling.join(', ')}` : ''}`;
      }).join('\n') || '(no active goals)';

      const raw = await groq(
        [
          {
            role: 'system',
            content:
              'You are Ascend studying a user\'s progress to surface 2-3 SHORT, sharp insights for their inbox — things you notice, patterns worth flagging, or a concrete suggestion to improve. Each is 1-2 sentences, specific to their data, never generic. Mix kinds: "observation" (a pattern you see), "suggestion" (a concrete change), "nudge" (a push toward action). Return STRICT JSON: {"items":[{"text":"...","kind":"observation"}]}. No preamble.'
              + `\n\n${personaTone(persona)}`,
          },
          {
            role: 'user',
            content: `User: ${profile?.first_name || 'there'}\n${averageDay ? `Typical day: ${averageDay}\n` : ''}\nGOALS:\n${goalCtx}\n\nACTIVITY:\n${checkSummary}`,
          },
        ],
        { json: true, temperature: 0.7, maxTokens: 500 }
      );

      const parsed = parseJSON<{ items: { text: string; kind: string }[] }>(raw, { items: [] });
      const now = new Date().toISOString();
      const fresh: InboxItem[] = (parsed.items || []).slice(0, 3).map((it, idx) => ({
        id: `${Date.now()}-${idx}`,
        text: it.text,
        kind: it.kind || 'observation',
        created_at: now,
        read: false,
      }));

      const existing = await loadItems();
      const combined = [...fresh, ...existing];
      await saveItems(combined);
      return NextResponse.json({ items: combined });
    }

    // default: list
    const items = await loadItems();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
