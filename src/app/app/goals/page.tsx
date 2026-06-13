'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { waitForSession } from '@/lib/session';
import { C, area } from '@/lib/design';
import { Spinner } from '@/components/ui';
import type { Goal } from '@/lib/types';

export default function GoalsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const open = (g: Goal) => { router.push(`/app/goals/${g.id}`); };
  const active = goals.filter((g) => g.status === 'active');
  const paused = goals.filter((g) => g.status !== 'active');

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Goals</h1>
        <button onClick={() => router.push('/app/goals/new')} style={{ background: C.orange, color: '#fff', borderRadius: 12, padding: '9px 16px', fontWeight: 600, fontSize: 14 }}>+ New</button>
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

