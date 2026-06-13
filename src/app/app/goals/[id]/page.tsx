'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { waitForSession } from '@/lib/session';
import { C, SERIF, area } from '@/lib/design';
import { Spinner, PrimaryButton } from '@/components/ui';
import type { Goal, Task } from '@/lib/types';

export default function GoalDetailPage() {
  const params = useParams();
  const goalId = String(params.id);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [recal, setRecal] = useState(false);

  async function load(id: string) {
    try {
      const res = await fetch('/api/goals/list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      setGoals((data.goals as Goal[]) || []);
    } catch { /* ignore */ }
    setLoaded(true);
  }

  useEffect(() => {
    waitForSession().then((session) => {
      if (!session) { window.location.href = '/auth'; return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, []);

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const idx = goals.findIndex((g) => g.id === goalId);
  const goal = goals[idx];
  if (!goal) {
    return (
      <div style={{ padding: 30, textAlign: 'center' }}>
        <p style={{ color: C.muted }}>Goal not found.</p>
        <button onClick={() => router.push('/app/goals')} style={{ color: C.orange, fontWeight: 600 }}>← Back to goals</button>
      </div>
    );
  }

  const a = area(goal.area);
  const prev = idx > 0 ? goals[idx - 1] : null;
  const next = idx < goals.length - 1 ? goals[idx + 1] : null;
  const missedTask = (goal.tasks || []).find((t) => (t.consecutive_misses || 0) >= 2);

  async function toggleStatus() {
    const status = goal.status === 'active' ? 'paused' : 'active';
    await fetch('/api/goals/update-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, status }),
    });
    load(userId);
  }

  function editInCoach() {
    window.location.href = `/app/coach?goal=${goal.id}`;
  }

  return (
    <div style={{ padding: 'max(16px, env(safe-area-inset-top)) 18px 24px' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => router.push('/app/goals')} style={{ color: C.muted, fontSize: 14, fontWeight: 600 }}>← Goals</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => prev && (window.location.href = `/app/goals/${prev.id}`)} disabled={!prev}
            style={{ padding: '6px 12px', borderRadius: 9, background: prev ? C.sand : 'transparent', color: prev ? C.dark : C.faint, fontSize: 13, fontWeight: 600 }}>‹ Prev</button>
          <button onClick={() => next && (window.location.href = `/app/goals/${next.id}`)} disabled={!next}
            style={{ padding: '6px 12px', borderRadius: 9, background: next ? C.sand : 'transparent', color: next ? C.dark : C.faint, fontSize: 13, fontWeight: 600 }}>Next ›</button>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 30 }}>{a.emoji}</span>
        <div style={{ flex: 1 }}>
          <h1 className="serif" style={{ fontSize: 24, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>{goal.title}</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
            {a.label}{goal.duration ? ` · ${goal.duration}` : ''}{goal.status !== 'active' ? ' · Paused' : ''}
          </div>
        </div>
      </div>

      {/* Completion */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.muted, marginBottom: 6 }}>
          <span>Completion</span><span style={{ fontWeight: 700, color: a.color }}>{goal.completion_pct}%</span>
        </div>
        <div style={{ height: 10, background: C.sand, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${goal.completion_pct}%`, background: a.color, borderRadius: 6, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Recalibration warning */}
      {missedTask && goal.status === 'active' && !recal && (
        <div style={{ marginTop: 18, background: '#FDDEDE', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#C62828' }}>This isn&apos;t failure.</div>
          <div style={{ fontSize: 13.5, color: '#8a2020', marginTop: 6, lineHeight: 1.5 }}>
            &ldquo;{missedTask.name}&rdquo; got missed 2× in a row. That&apos;s a signal — the plan needs to flex around your reality.
          </div>
          <button onClick={() => setRecal(true)} style={{ marginTop: 12, background: '#C62828', color: '#fff', borderRadius: 11, padding: '10px 18px', fontWeight: 600, fontSize: 13.5 }}>Fix it →</button>
        </div>
      )}

      {recal && (
        <RecalibratePanel userId={userId} goal={goal} onClose={() => setRecal(false)} onApplied={() => { setRecal(false); load(userId); }} />
      )}

      {/* Tasks */}
      <div style={{ marginTop: 24 }}>
        <Label>Recurring tasks</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(goal.tasks || []).map((t: Task) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px 14px' }}>
              <div>
                <div style={{ fontSize: 14.5, color: C.dark }}>{t.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{t.frequency || ''}{t.duration ? ` · ${t.duration}` : ''}</div>
              </div>
              {(t.consecutive_misses || 0) >= 2 && <span style={{ fontSize: 11, fontWeight: 700, color: '#C62828' }}>missed 2×</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Coach tip */}
      {goal.motivation && (
        <div style={{ marginTop: 20, padding: '14px 16px', background: a.soft, borderRadius: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: a.color, marginBottom: 6 }}>YOUR WHY</div>
          <div style={{ fontSize: 14, fontStyle: 'italic', color: C.dark, fontFamily: SERIF, lineHeight: 1.5 }}>&ldquo;{goal.motivation}&rdquo;</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={editInCoach} style={{ width: '100%', padding: '14px', borderRadius: 14, background: C.dark, color: '#fff', fontWeight: 600, fontSize: 15 }}>
          ✎ Edit with Coach
        </button>
        <button onClick={toggleStatus} style={{ width: '100%', padding: '13px', borderRadius: 14, background: C.sand, color: C.dark, fontWeight: 600, fontSize: 14.5 }}>
          {goal.status === 'active' ? 'Pause this goal' : 'Resume this goal'}
        </button>
      </div>
    </div>
  );
}

function RecalibratePanel({ userId, goal, onClose, onApplied }: { userId: string; goal: Goal; onClose: () => void; onApplied: () => void }) {
  const REASONS = ['No time', 'Too tired', 'Too hard', 'Lost motivation', 'Got sick', 'Forgot'];
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function getProposal() {
    const r = custom.trim() || reason;
    if (!r) return;
    setLoading(true); setProposal('');
    try {
      const res = await fetch('/api/recalibrate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goalId: goal.id, reason: r, action: 'propose' }),
      });
      const data = await res.json();
      setProposal(data.proposal || '');
    } catch { /* ignore */ }
    setLoading(false);
  }
  async function apply() {
    setApplying(true);
    await fetch('/api/recalibrate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, goalId: goal.id, reason: custom.trim() || reason, proposal, action: 'apply' }),
    });
    onApplied();
  }

  return (
    <div style={{ marginTop: 18, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 className="serif" style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Let&apos;s recalibrate</h3>
        <button onClick={onClose} style={{ color: C.faint, fontSize: 22 }}>×</button>
      </div>
      <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 12px' }}>What&apos;s been getting in the way?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {REASONS.map((r) => (
          <button key={r} onClick={() => { setReason(r); setCustom(''); }} style={{
            padding: '9px 14px', borderRadius: 11, fontSize: 13.5, fontWeight: 600,
            background: reason === r && !custom ? C.orange : C.sand, color: reason === r && !custom ? '#fff' : C.muted,
          }}>{r}</button>
        ))}
      </div>
      <textarea value={custom} onChange={(e) => { setCustom(e.target.value); if (e.target.value) setReason(''); }}
        rows={2} placeholder="Or describe it in your own words…"
        style={{ width: '100%', marginTop: 10, padding: '11px 13px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 16, outline: 'none' }} />
      <button onClick={getProposal} disabled={loading || (!reason && !custom.trim())}
        style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 12, background: (reason || custom.trim()) ? C.orange : C.faint, color: C.onAccent, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading && <Spinner size={16} color={C.onAccent} />}Get AI proposal
      </button>
      {proposal && (
        <div className="fadein" style={{ marginTop: 14 }}>
          <div style={{ padding: '14px 16px', background: C.orangeSoft, borderRadius: 14, fontSize: 14.5, color: C.onAccent, lineHeight: 1.5 }}>{proposal}</div>
          <div style={{ marginTop: 12 }}><PrimaryButton onClick={apply} loading={applying}>Apply this change</PrimaryButton></div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted, marginBottom: 10 }}>{children}</div>;
}
