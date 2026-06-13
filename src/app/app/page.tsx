'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { waitForSession } from '@/lib/session';
import { C, SERIF, area, greeting, todayISO, dailyQuote, nextQuote } from '@/lib/design';
import { Logo, Spinner, BottomSheet } from '@/components/ui';
import type { DayBlock, DeferredItem } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [streak, setStreak] = useState(0);
  const [quote, setQuote] = useState(dailyQuote());

  const [energy, setEnergy] = useState('Medium');
  const [hours, setHours] = useState('');
  const [mood, setMood] = useState<string[]>([]);
  const [todayNote, setTodayNote] = useState('');
  const [blocks, setBlocks] = useState<(DayBlock & { done?: boolean })[]>([]);
  const [deferred, setDeferred] = useState<DeferredItem[]>([]);
  const [advice, setAdvice] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [sheet, setSheet] = useState<null | 'options' | 'tune'>(null);

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
        const plan = data.dayPlan;
        if (plan) {
          setBlocks((plan.blocks as DayBlock[]) || []);
          setDeferred((plan.deferred as DeferredItem[]) || []);
          setAdvice(plan.advice || '');
          setEnergy(plan.energy || 'Medium');
          if (plan.hours_available) setHours(String(plan.hours_available));
        }
      } catch { /* ignore */ }
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

  function toggleMood(m: string) {
    setMood((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function generatePlan(mode: 'quick' | 'tune') {
    if (!userId) return;
    setSheet(null);
    setPlanLoading(true);
    try {
      const res = await fetch('/api/day-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, date, mode,
          energy: mode === 'tune' ? energy : undefined,
          hours: mode === 'tune' && hours ? parseInt(hours, 10) : undefined,
          mood: mode === 'tune' ? mood.join(', ') : undefined,
          todayNote: mode === 'tune' ? todayNote : undefined,
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
    const block = blocks[i];
    const nowDone = !block.done;
    const updated = blocks.map((b, idx) => (idx === i ? { ...b, done: nowDone } : b));
    setBlocks(updated);
    // Persist the visual check on the plan.
    try {
      await fetch('/api/day-plan/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, blocks: updated }),
      });
    } catch { /* ignore — UI already updated */ }
    // If this block came from a real goal task, record a proper check-in so goal
    // completion %, the two-strike counter, and future plans all stay in sync.
    if (block.task_id) {
      try {
        await fetch('/api/tasks/checkin', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, taskId: block.task_id, date, completed: nowDone }),
        });
      } catch { /* ignore */ }
    }
  }

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const hasPlan = blocks.length > 0;

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: C.muted, fontSize: 14 }}>{greeting()},</div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 16 }}>{firstName || 'there'}</div>
        </div>
        <button onClick={() => router.push('/app/settings')} aria-label="Settings"
          style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

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

      {/* AI day plan */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>AI day plan</div>
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

      {/* Options sheet */}
      {sheet && (
        <BottomSheet onClose={() => setSheet(null)}>
          {sheet === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>Day plan</h2>
              <OptBtn emoji="⚡" title="Quick generate" sub="Built from your goals and deadlines" onClick={() => generatePlan('quick')} />
              <OptBtn emoji="🎯" title="Plan my day" sub="Add what's specific to today + how you feel" onClick={() => setSheet('tune')} />
            </div>
          )}
          {sheet === 'tune' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Plan my day</h2>

              <div>
                <Label>Anything specific for today?</Label>
                <textarea value={todayNote} onChange={(e) => setTodayNote(e.target.value)} rows={3}
                  placeholder="e.g. Doctor's appt at 3pm, must finish the report, keep it light — feeling drained"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 13, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none' }} />
              </div>

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
              <button onClick={() => generatePlan('tune')} style={{ padding: '14px', borderRadius: 14, background: C.orange, color: '#fff', fontWeight: 600, fontSize: 15 }}>Generate plan</button>
            </div>
          )}
        </BottomSheet>
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

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>{children}</div>;
}
function chip(active: boolean): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: active ? C.orange : C.sand, color: active ? '#fff' : C.muted };
}
