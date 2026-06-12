'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSession } from '@/lib/session';
import { C, SERIF, area, greeting, todayISO, dailyQuote, nextQuote } from '@/lib/design';
import { Logo, Spinner, Card } from '@/components/ui';
import type { Priority, DayBlock, DeferredItem } from '@/lib/types';

export default function HomePage() {
  const [userId, setUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [streak, setStreak] = useState(0);
  const [quote, setQuote] = useState(dailyQuote());

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

  const [sheet, setSheet] = useState<null | 'options' | 'mood'>(null);

  const date = todayISO();
  const MOODS = ['Focused', 'Tired', 'Anxious', 'Motivated', 'Busy', 'Calm'];

  useEffect(() => {
    (async () => {
      const session = await waitForSession();
      if (!session) { window.location.href = '/auth'; return; }
      const id = session.user.id;
      setUserId(id);
      try {
        const res = await fetch('/api/home-data', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, date }),
        });
        const data = await res.json();
        setFirstName(data.firstName || '');
        setPriorities(data.priorities || []);
        const plan = data.dayPlan;
        if (plan) {
          setBlocks((plan.blocks as DayBlock[]) || []);
          setDeferred((plan.deferred as DeferredItem[]) || []);
          setAdvice(plan.advice || '');
          setEnergy(plan.energy || 'Medium');
          if (plan.hours_available) setHours(String(plan.hours_available));
        }
      } catch { /* ignore */ }

      // Login streak — records today's visit and returns the consecutive count.
      try {
        const sres = await fetch('/api/streak', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id }),
        });
        const sdata = await sres.json();
        setStreak(sdata.streak || 0);
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [date]);

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

  async function generatePlan(useMood: boolean) {
    if (!userId) return;
    setSheet(null);
    setPlanLoading(true);
    try {
      const res = await fetch('/api/day-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, date,
          energy: useMood ? energy : 'Medium',
          hours: useMood && hours ? parseInt(hours, 10) : null,
          mood: useMood ? mood.join(', ') : '',
        }),
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

  const hasPlan = blocks.length > 0;

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <div style={{ color: C.muted, fontSize: 14 }}>{greeting()},</div>
      <div className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>{firstName || 'there'}</div>

      {/* Streak + motivation + logo block */}
      <div style={{ background: C.dark, borderRadius: 20, padding: 18, display: 'flex', alignItems: 'center', gap: 16, color: '#fff' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: C.faint }}>STREAK</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span className="serif" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: 14, color: '#E8E2D6' }}>{streak === 1 ? 'day' : 'days'}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: '#E8E2D6', lineHeight: 1.45, fontStyle: 'italic', fontFamily: SERIF }}>
            &ldquo;{quote}&rdquo;
          </div>
        </div>
        <button onClick={() => setQuote((q) => nextQuote(q))}
          style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 16, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="New motivation">
          <Logo size={32} />
        </button>
      </div>

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

      {/* AI day plan — button opens options */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionTitle noMargin>AI day plan</SectionTitle>
          <button onClick={() => setSheet('options')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, flexShrink: 0, whiteSpace: 'nowrap', background: C.orange, color: '#fff', borderRadius: 12, padding: '10px 18px', fontWeight: 600, fontSize: 14 }}>
            {planLoading ? <Spinner size={15} color="#fff" /> : <span style={{ fontSize: 15 }}>✦</span>}
            <span>{hasPlan ? 'Update' : 'Generate'}</span>
          </button>
        </div>

        {advice && (
          <div style={{ padding: '12px 14px', background: C.orangeSoft, borderRadius: 13, fontSize: 14, color: C.dark, marginBottom: 12 }}>💡 {advice}</div>
        )}

        {hasPlan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        ) : (
          <button onClick={() => setSheet('options')} style={{ width: '100%', padding: '22px', borderRadius: 16, border: `1.5px dashed ${C.border}`, background: '#fff', color: C.muted, fontSize: 14 }}>
            Tap to generate your time-blocked day from your goals.
          </button>
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

      {/* Options sheet — fixed to the shell bottom, never tied to scroll position */}
      {sheet && (
        <div onClick={() => setSheet(null)} className="fadein"
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,24,21,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 430, maxHeight: '80dvh',
              display: 'flex', flexDirection: 'column',
              background: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
            }}>
            <div style={{ flexShrink: 0, padding: '12px 0 0' }}>
              <div style={{ width: 40, height: 4, background: C.sand, borderRadius: 3, margin: '0 auto' }} />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 20px max(24px, env(safe-area-inset-bottom))' }}>
              {sheet === 'options' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Day plan</h2>
                  <OptBtn emoji="⚡" title="Quick generate" sub="Build from your goals, no extra input" onClick={() => generatePlan(false)} />
                  <OptBtn emoji="🎭" title="By mood & energy" sub="Tune it to how you feel today" onClick={() => setSheet('mood')} />
                  {hasPlan && <OptBtn emoji="🔄" title="Regenerate" sub="Replace today's plan" onClick={() => generatePlan(false)} />}
                </div>
              )}
              {sheet === 'mood' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Tune your plan</h2>
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
                      {MOODS.map((m) => (<button key={m} onClick={() => toggleMood(m)} style={chip(mood.includes(m))}>{m}</button>))}
                    </div>
                  </div>
                  <button onClick={() => generatePlan(true)} style={{ padding: '14px', borderRadius: 14, background: C.orange, color: '#fff', fontWeight: 600, fontSize: 15 }}>Generate plan</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OptBtn({ emoji, title, sub, onClick }: { emoji: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.dark }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: C.muted, marginTop: 1 }}>{sub}</span>
      </span>
      <span style={{ color: C.faint, fontSize: 18 }}>›</span>
    </button>
  );
}

function SectionTitle({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: noMargin ? 0 : 10 }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>{children}</div>;
}
function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: active ? C.orange : C.sand, color: active ? '#fff' : C.muted };
}
