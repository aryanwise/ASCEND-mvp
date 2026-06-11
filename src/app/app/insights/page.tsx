'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSession } from '@/lib/session';
import { C, SERIF, area } from '@/lib/design';
import { Spinner } from '@/components/ui';
import type { Goal } from '@/lib/types';

interface DayStat { label: string; date: string; pct: number; }

export default function InsightsPage() {
  const [loaded, setLoaded] = useState(false);
  const [observation, setObservation] = useState('');
  const [obsLoading, setObsLoading] = useState(true);
  const [week, setWeek] = useState<DayStat[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    (async () => {
      const session = await waitForSession();
      if (!session) { window.location.href = '/auth'; return; }
      const id = session.user.id;

      const days: DayStat[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), date: d.toISOString().slice(0, 10), pct: 0 });
      }
      const since = days[0].date;

      let checkins: { date: string; completed: boolean }[] = [];
      let gs: Goal[] = [];
      try {
        const res = await fetch('/api/insights-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, since }),
        });
        const data = await res.json();
        checkins = data.checkins || [];
        gs = (data.goals as Goal[]) || [];
      } catch { /* ignore */ }

      const byDate: Record<string, { t: number; d: number }> = {};
      checkins.forEach((c) => {
        byDate[c.date] = byDate[c.date] || { t: 0, d: 0 };
        byDate[c.date].t++;
        if (c.completed) byDate[c.date].d++;
      });
      days.forEach((day) => {
        const s = byDate[day.date];
        day.pct = s && s.t ? Math.round((s.d / s.t) * 100) : 0;
      });
      setWeek(days);
      setGoals(gs);
      setLoaded(true);

      fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: id }) })
        .then((r) => r.json()).then((d) => setObservation(d.observation || '')).catch(() => {}).finally(() => setObsLoading(false));
    })();
  }, []);

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const withData = week.filter((d) => d.pct > 0);
  const avg = withData.length ? Math.round(withData.reduce((s, d) => s + d.pct, 0) / withData.length) : 0;
  const best = week.reduce((b, d) => (d.pct > b.pct ? d : b), week[0]);
  const maxPct = Math.max(100, ...week.map((d) => d.pct));

  function health(pct: number): { label: string; color: string } {
    if (pct >= 60) return { label: 'On track', color: '#1B7A5C' };
    if (pct >= 30) return { label: 'Slipping', color: '#B8721C' };
    return { label: 'At risk', color: '#C62828' };
  }

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '0 0 18px' }}>Insights</h1>

      <div style={{ background: C.orangeSoft, borderRadius: 16, padding: '16px 18px', marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Observation</div>
        {obsLoading ? <Spinner size={18} /> : <div style={{ fontSize: 15.5, color: C.dark, lineHeight: 1.45, fontFamily: SERIF }}>{observation}</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 12 }}>Last 7 days</div>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 120 }}>
          {week.map((d) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>{d.pct}%</div>
              <div style={{ width: '70%', height: `${(d.pct / maxPct) * 90}%`, minHeight: d.pct > 0 ? 4 : 2, background: d.pct > 0 ? C.orange : C.sand, borderRadius: 5, transition: 'height 0.4s' }} />
              <div style={{ fontSize: 11, color: C.muted }}>{d.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <Stat label="Average" value={`${avg}%`} />
          <Stat label="Best day" value={best.pct > 0 ? best.label : '—'} />
        </div>
      </div>

      {goals.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, margin: '24px 0 12px' }}>Goal health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals.map((g) => {
              const a = area(g.area);
              const h = health(g.completion_pct);
              return (
                <div key={g.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{a.emoji} {g.title}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: h.color }}>{h.label}</span>
                  </div>
                  <div style={{ height: 7, background: C.sand, borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.completion_pct}%`, background: h.color, borderRadius: 5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {best.pct > 0 && (
        <div style={{ marginTop: 22, padding: '14px 16px', background: C.sand, borderRadius: 14, fontSize: 14, color: C.dark }}>
          💡 Schedule your hardest tasks on <b>{best.label}</b> — that&apos;s when you show up most.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: C.orange }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
    </div>
  );
}
