'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C, SERIF, area, greeting, todayISO, QUOTES } from '@/lib/design';
import { Logo, Spinner, Card } from '@/components/ui';
import type { Priority, DayBlock, DeferredItem } from '@/lib/types';

export default function HomePage() {
  const [userId, setUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [showQuote, setShowQuote] = useState(false);

  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [newPrio, setNewPrio] = useState('');

  const [energy, setEnergy] = useState('Medium');
  const [hours, setHours] = useState('');
  const [mood, setMood] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<(DayBlock & { done?: boolean })[]>([]);
  const [deferred, setDeferred] = useState<DeferredItem[]>([]);
  const [advice, setAdvice] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const date = todayISO();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id;
      if (!id) { window.location.href = '/auth'; return; }
      setUserId(id);

      const [{ data: profile }, { data: prio }, { data: plan }] = await Promise.all([
        supabase.from('profiles').select('first_name').eq('id', id).maybeSingle(),
        supabase.from('priorities').select('*').eq('user_id', id).eq('date', date).order('id'),
        supabase.from('day_plans').select('*').eq('user_id', id).eq('date', date).maybeSingle(),
      ]);
      setFirstName(profile?.first_name || '');
      setPriorities(prio || []);
      if (plan) {
        setBlocks((plan.blocks as DayBlock[]) || []);
        setDeferred((plan.deferred as DeferredItem[]) || []);
        setAdvice(plan.advice || '');
        setEnergy(plan.energy || 'Medium');
        if (plan.hours_available) setHours(String(plan.hours_available));
      }
      setLoaded(true);
    })();
  }, [date]);

  function cycleQuote() {
    setShowQuote(true);
    setQuoteIdx((i) => (i + 1) % QUOTES.length);
  }

  async function addPriority() {
    const text = newPrio.trim();
    if (!text || !userId) return;
    setNewPrio('');
    const { data } = await supabase.from('priorities').insert({ user_id: userId, date, text, done: false }).select().single();
    if (data) setPriorities((p) => [...p, data]);
  }

  async function togglePriority(p: Priority) {
    setPriorities((list) => list.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)));
    await supabase.from('priorities').update({ done: !p.done }).eq('id', p.id);
  }

  async function deletePriority(p: Priority) {
    setPriorities((list) => list.filter((x) => x.id !== p.id));
    await supabase.from('priorities').delete().eq('id', p.id);
  }

  function toggleMood(m: string) {
    setMood((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function generatePlan() {
    if (!userId) return;
    setPlanLoading(true);
    try {
      const res = await fetch('/api/day-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, energy, hours: hours ? parseInt(hours, 10) : null, mood: mood.join(', ') }),
      });
      const data = await res.json();
      setBlocks((data.blocks || []).map((b: DayBlock) => ({ ...b, done: false })));
      setDeferred(data.deferred || []);
      setAdvice(data.advice || '');
    } catch { /* ignore */ }
    setPlanLoading(false);
  }

  async function toggleBlock(i: number) {
    const updated = blocks.map((b, idx) => (idx === i ? { ...b, done: !b.done } : b));
    setBlocks(updated);
    await supabase.from('day_plans').update({ blocks: updated }).eq('user_id', userId).eq('date', date);
  }

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const MOODS = ['Focused', 'Tired', 'Anxious', 'Motivated', 'Busy', 'Calm'];

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: C.muted, fontSize: 14 }}>{greeting()},</div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 600 }}>{firstName || 'there'}</div>
        </div>
        <button onClick={cycleQuote}><Logo size={40} /></button>
      </div>

      {showQuote && (
        <div className="fadein" key={quoteIdx} style={{ marginTop: 14, padding: '14px 16px', background: C.orangeSoft, borderRadius: 14, color: C.dark, fontSize: 14.5, fontStyle: 'italic', fontFamily: SERIF }}>
          “{QUOTES[quoteIdx]}”
        </div>
      )}

      {/* Priorities */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>Today&apos;s priorities</SectionTitle>
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newPrio} onChange={(e) => setNewPrio(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPriority()}
              placeholder="Add a priority…"
              style={{ flex: 1, padding: '11px 12px', borderRadius: 11, border: `1px solid ${C.border}`, fontSize: 16, outline: 'none' }} />
            <button onClick={addPriority} style={{ width: 44, borderRadius: 11, background: C.orange, color: '#fff', fontSize: 22 }}>+</button>
          </div>
          {priorities.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {priorities.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => togglePriority(p)}
                    style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `2px solid ${p.done ? C.orange : C.faint}`, background: p.done ? C.orange : 'transparent', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.done ? '✓' : ''}
                  </button>
                  <span style={{ flex: 1, fontSize: 14.5, textDecoration: p.done ? 'line-through' : 'none', color: p.done ? C.faint : C.dark }}>{p.text}</span>
                  <button onClick={() => deletePriority(p)} style={{ color: C.faint, fontSize: 18, padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI Day Plan */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>AI day plan</SectionTitle>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Label>Energy</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Low', 'Medium', 'High'].map((e) => (
                  <button key={e} onClick={() => setEnergy(e)} style={chip(energy === e)}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <Label>Hours available</Label>
              <input value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 4" inputMode="numeric"
                style={{ width: 90, padding: '10px 12px', borderRadius: 11, border: `1px solid ${C.border}`, fontSize: 16, outline: 'none' }} />
            </div>
            <div>
              <Label>Mood</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {MOODS.map((m) => (
                  <button key={m} onClick={() => toggleMood(m)} style={chip(mood.includes(m))}>{m}</button>
                ))}
              </div>
            </div>
            <button onClick={generatePlan} disabled={planLoading}
              style={{ marginTop: 4, padding: '13px', borderRadius: 13, background: planLoading ? C.faint : C.orange, color: '#fff', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              {planLoading && <Spinner size={17} color="#fff" />}
              {blocks.length ? 'Regenerate plan' : 'Generate plan'}
            </button>
          </div>
        </Card>

        {advice && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: C.orangeSoft, borderRadius: 13, fontSize: 14, color: C.dark }}>
            💡 {advice}
          </div>
        )}

        {blocks.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocks.map((b, i) => {
              const a = area(b.area);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: a.color }} />
                  <div style={{ width: 66, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.muted }}>{b.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, textDecoration: b.done ? 'line-through' : 'none', color: b.done ? C.faint : C.dark }}>{b.task}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{a.emoji} {a.label}{b.duration ? ` · ${b.duration}` : ''}</div>
                  </div>
                  <button onClick={() => toggleBlock(i)}
                    style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, border: `2px solid ${b.done ? a.color : C.faint}`, background: b.done ? a.color : 'transparent', color: '#fff', fontSize: 14 }}>
                    {b.done ? '✓' : ''}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {deferred.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Label>Deferred</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {deferred.map((d, i) => (
                <div key={i} style={{ background: C.sand, borderRadius: 12, padding: '10px 13px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.dark }}>{d.task}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{d.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 10 }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>{children}</div>;
}
function chip(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
    background: active ? C.orange : C.sand, color: active ? '#fff' : C.muted,
  };
}
