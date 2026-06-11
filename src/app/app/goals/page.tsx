'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C, SERIF, area, AREA_LIST } from '@/lib/design';
import { Spinner, PrimaryButton } from '@/components/ui';
import type { Goal, Task, QA } from '@/lib/types';

export default function GoalsPage() {
  const [userId, setUserId] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recalGoal, setRecalGoal] = useState<Goal | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load(id: string) {
    const { data } = await supabase
      .from('goals')
      .select('*, tasks(*)')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    setGoals((data as Goal[]) || []);
    setLoaded(true);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (!id) { window.location.href = '/auth'; return; }
      setUserId(id);
      load(id);
    });
  }, []);

  async function toggleStatus(g: Goal) {
    const status = g.status === 'active' ? 'paused' : 'active';
    setGoals((list) => list.map((x) => (x.id === g.id ? { ...x, status } : x)));
    await supabase.from('goals').update({ status }).eq('id', g.id);
  }

  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status !== 'active');

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Goals</h1>
        <button onClick={() => setShowNew(true)} style={{ background: C.orange, color: '#fff', borderRadius: 12, padding: '9px 16px', fontWeight: 600, fontSize: 14 }}>+ New</button>
      </div>

      {active.length === 0 && paused.length === 0 && (
        <div style={{ textAlign: 'center', color: C.muted, padding: 40, fontSize: 15 }}>
          No goals yet. Tap <b>+ New</b> to build your first plan.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {active.map((g) => (
          <GoalCard key={g.id} goal={g} expanded={expanded === g.id}
            onExpand={() => setExpanded(expanded === g.id ? null : g.id)}
            onPause={() => toggleStatus(g)} onFix={() => setRecalGoal(g)} />
        ))}
      </div>

      {paused.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, margin: '26px 0 12px' }}>Paused</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paused.map((g) => (
              <div key={g.id} style={{ opacity: 0.6 }}>
                <GoalCard goal={g} expanded={false} onExpand={() => {}} paused onPause={() => toggleStatus(g)} onFix={() => {}} />
              </div>
            ))}
          </div>
        </>
      )}

      {recalGoal && (
        <RecalibrateModal userId={userId} goal={recalGoal}
          onClose={() => setRecalGoal(null)}
          onApplied={() => { setRecalGoal(null); load(userId); }} />
      )}

      {showNew && (
        <NewGoalModal userId={userId} onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(userId); }} />
      )}
    </div>
  );
}

function GoalCard({ goal, expanded, onExpand, onPause, onFix, paused }: {
  goal: Goal; expanded: boolean; onExpand: () => void; onPause: () => void; onFix: () => void; paused?: boolean;
}) {
  const a = area(goal.area);
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
      {goal.needs_recalibration && !paused && (
        <div style={{ background: '#FDDEDE', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#C62828', fontWeight: 600 }}>⚠️ You&apos;ve slipped twice — let&apos;s recalibrate</span>
          <button onClick={onFix} style={{ color: '#C62828', fontWeight: 700, fontSize: 13.5 }}>Fix →</button>
        </div>
      )}
      <div style={{ padding: 16 }}>
        <div onClick={onExpand} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{a.emoji}</span>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 17, fontWeight: 600 }}>{goal.title}</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>{a.label}{goal.duration ? ` · ${goal.duration}` : ''}</div>
            </div>
            <span style={{ color: C.faint, fontSize: 18 }}>{expanded ? '▾' : '▸'}</span>
          </div>
          <div style={{ marginTop: 12, height: 8, background: C.sand, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${goal.completion_pct}%`, background: a.color, borderRadius: 6, transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{goal.completion_pct}% complete</div>
        </div>

        {expanded && (
          <div className="fadein" style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            {(goal.tasks || []).map((t: Task) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 14 }}>
                <span style={{ color: C.dark }}>{t.name}</span>
                <span style={{ color: C.muted, fontSize: 12.5 }}>{t.frequency || ''}</span>
              </div>
            ))}
            {goal.motivation && (
              <div style={{ marginTop: 10, padding: '11px 13px', background: a.soft, borderRadius: 12, fontSize: 13.5, fontStyle: 'italic', color: C.dark, fontFamily: SERIF }}>
                “{goal.motivation}”
              </div>
            )}
            <button onClick={onPause} style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: C.muted }}>
              {paused ? 'Resume goal' : 'Pause goal'}
            </button>
          </div>
        )}

        {paused && !expanded && (
          <button onClick={onPause} style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: C.orange }}>Resume</button>
        )}
      </div>
    </div>
  );
}

function RecalibrateModal({ userId, goal, onClose, onApplied }: {
  userId: string; goal: Goal; onClose: () => void; onApplied: () => void;
}) {
  const REASONS = ['No time', 'Too tired', 'Too hard', 'Lost motivation', 'Got sick', 'Forgot'];
  const [reason, setReason] = useState('');
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function propose(r: string) {
    setReason(r);
    setLoading(true);
    setProposal('');
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
      body: JSON.stringify({ userId, goalId: goal.id, reason, proposal, action: 'apply' }),
    });
    onApplied();
  }

  return (
    <Sheet onClose={onClose} title="Recalibrate">
      <p style={{ color: C.muted, fontSize: 14, marginTop: 0 }}>What kept getting in the way?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {REASONS.map((r) => (
          <button key={r} onClick={() => propose(r)} style={{
            padding: '9px 14px', borderRadius: 11, fontSize: 13.5, fontWeight: 600,
            background: reason === r ? C.orange : C.sand, color: reason === r ? '#fff' : C.muted,
          }}>{r}</button>
        ))}
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div>}
      {proposal && (
        <div className="fadein" style={{ marginTop: 16 }}>
          <div style={{ padding: '14px 16px', background: C.orangeSoft, borderRadius: 14, fontSize: 14.5, color: C.dark, lineHeight: 1.5 }}>{proposal}</div>
          <div style={{ marginTop: 14 }}>
            <PrimaryButton onClick={apply} loading={applying}>Apply this change</PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function NewGoalModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [stage, setStage] = useState<'area' | 'questions' | 'motivation'>('area');
  const [areaKey, setAreaKey] = useState('');
  const [goalText, setGoalText] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function toQuestions() {
    setErr('');
    if (!areaKey || goalText.trim().length < 6) { setErr('Pick an area and describe your goal.'); return; }
    setLoading(true);
    const res = await fetch('/api/goal-questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: areaKey, goal: goalText }),
    });
    const data = await res.json();
    setQuestions(data.questions || []);
    setLoading(false);
    setStage('questions');
  }

  async function create() {
    setErr('');
    if (motivation.trim().length < 4) { setErr('Add your reason.'); return; }
    setLoading(true);
    const dialogue: QA[] = questions.map((q, i) => ({ q, a: answers[i] }));
    const res = await fetch('/api/goals/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, area: areaKey, goal: goalText, dialogue, motivation: motivation.trim() }),
    });
    if (res.ok) onCreated();
    else { setErr('Could not create goal.'); setLoading(false); }
  }

  return (
    <Sheet onClose={onClose} title="New goal">
      {stage === 'area' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {AREA_LIST.map((a) => (
              <button key={a.key} onClick={() => setAreaKey(a.key)} style={{
                padding: '12px 6px', borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                background: areaKey === a.key ? a.soft : '#fff', border: `1.5px solid ${areaKey === a.key ? a.color : C.border}`,
              }}>
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>
          <textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={3} placeholder="Describe your goal…"
            style={{ ...inpStyle, marginTop: 12 }} />
          {err && <div style={{ color: '#C62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
          <div style={{ marginTop: 14 }}><PrimaryButton onClick={toQuestions} loading={loading}>Continue</PrimaryButton></div>
        </>
      )}
      {stage === 'questions' && (
        <>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{q}</div>
              <textarea value={answers[i]} onChange={(e) => { const n = [...answers]; n[i] = e.target.value; setAnswers(n); }} rows={2} placeholder="Your answer…" style={inpStyle} />
            </div>
          ))}
          {err && <div style={{ color: '#C62828', fontSize: 13 }}>{err}</div>}
          <PrimaryButton onClick={() => { if (answers.some((a) => !a.trim())) { setErr('Answer all three.'); return; } setErr(''); setStage('motivation'); }}>Continue</PrimaryButton>
        </>
      )}
      {stage === 'motivation' && (
        <>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Why does this matter?</div>
          <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} placeholder="Your real reason…" style={inpStyle} />
          {err && <div style={{ color: '#C62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
          <div style={{ marginTop: 14 }}><PrimaryButton onClick={create} loading={loading}>Build my plan</PrimaryButton></div>
        </>
      )}
    </Sheet>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fadein" style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(26,24,21,0.4)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '88%', overflowY: 'auto', background: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: '20px 20px max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ width: 40, height: 4, background: C.sand, borderRadius: 3, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ color: C.faint, fontSize: 24 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inpStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none',
};
