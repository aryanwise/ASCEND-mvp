'use client';
import React, { useEffect, useState } from 'react';
import { waitForSession } from '@/lib/session';
import { C, SERIF, area, AREA_LIST } from '@/lib/design';
import { Spinner, PrimaryButton } from '@/components/ui';
import type { Goal, QA } from '@/lib/types';

export default function GoalsPage() {
  const [userId, setUserId] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load(id: string) {
    try {
      const res = await fetch('/api/goals/list', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      setGoals((data.goals as Goal[]) || []);
    } catch { setGoals([]); }
    setLoaded(true);
  }

  useEffect(() => {
    waitForSession().then((session) => {
      if (!session) { window.location.href = '/auth'; return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, []);

  async function unpause(g: Goal, e: React.MouseEvent) {
    e.stopPropagation();
    setGoals((list) => list.map((x) => (x.id === g.id ? { ...x, status: 'active' } : x)));
    await fetch('/api/goals/update-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: g.id, status: 'active' }),
    });
    load(userId);
  }

  const open = (g: Goal) => { window.location.href = `/app/goals/${g.id}`; };
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
        {active.map((g) => <GoalCard key={g.id} goal={g} onClick={() => open(g)} />)}
      </div>

      {paused.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, margin: '26px 0 12px' }}>Paused</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {paused.map((g) => (
              <div key={g.id} style={{ position: 'relative' }}>
                <button onClick={(e) => unpause(g, e)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: C.orange, color: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 }}>Unpause</button>
                <div style={{ opacity: 0.55 }}><GoalCard goal={g} onClick={() => open(g)} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {showNew && <NewGoalModal userId={userId} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(userId); }} />}
    </div>
  );
}

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const a = area(goal.area);
  const missed = (goal.tasks || []).some((t) => (t.consecutive_misses || 0) >= 2);
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
      {missed && goal.status === 'active' && (
        <div style={{ background: '#FDDEDE', padding: '8px 16px', fontSize: 12.5, color: '#C62828', fontWeight: 600 }}>⚠️ Needs recalibration — tap to fix</div>
      )}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{a.emoji}</span>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 17, fontWeight: 600 }}>{goal.title}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>{a.label}{goal.duration ? ` · ${goal.duration}` : ''}</div>
          </div>
          <span style={{ color: C.faint, fontSize: 18 }}>›</span>
        </div>
        <div style={{ marginTop: 12, height: 8, background: C.sand, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${goal.completion_pct}%`, background: a.color, borderRadius: 6 }} />
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>{goal.completion_pct}% complete</div>
      </div>
    </button>
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
    <div onClick={onClose} className="fadein" style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(26,24,21,0.4)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '88%', overflowY: 'auto', background: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: '20px 20px max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ width: 40, height: 4, background: C.sand, borderRadius: 3, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>New goal</h2>
          <button onClick={onClose} style={{ color: C.faint, fontSize: 24 }}>×</button>
        </div>
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
            <textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={3} placeholder="Describe your goal…" style={inpStyle2} />
            {err && <div style={{ color: '#C62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
            <div style={{ marginTop: 14 }}><PrimaryButton onClick={toQuestions} loading={loading}>Continue</PrimaryButton></div>
          </>
        )}
        {stage === 'questions' && (
          <>
            {questions.map((q, i) => (
              <div key={i} style={{ marginBottom: 13 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{q}</div>
                <textarea value={answers[i]} onChange={(e) => { const n = [...answers]; n[i] = e.target.value; setAnswers(n); }} rows={2} placeholder="Your answer…" style={inpStyle2} />
              </div>
            ))}
            {err && <div style={{ color: '#C62828', fontSize: 13 }}>{err}</div>}
            <PrimaryButton onClick={() => { if (answers.some((a) => !a.trim())) { setErr('Answer all three.'); return; } setErr(''); setStage('motivation'); }}>Continue</PrimaryButton>
          </>
        )}
        {stage === 'motivation' && (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Why does this matter?</div>
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} placeholder="Your real reason…" style={inpStyle2} />
            {err && <div style={{ color: '#C62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
            <div style={{ marginTop: 14 }}><PrimaryButton onClick={create} loading={loading}>Build my plan</PrimaryButton></div>
          </>
        )}
      </div>
    </div>
  );
}

const inpStyle2: React.CSSProperties = {
  width: '100%', marginTop: 12, padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none',
};
