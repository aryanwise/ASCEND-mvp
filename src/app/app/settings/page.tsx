'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { waitForSession } from '@/lib/session';
import { C, SERIF } from '@/lib/design';
import { Spinner, PrimaryButton } from '@/components/ui';

const PERSONAS = [
  { key: 'balanced', emoji: '⚖️', title: 'Balanced', desc: 'Supportive but honest. Has your back, still holds you accountable.' },
  { key: 'strategist', emoji: '♟️', title: 'Strategist', desc: 'Calm and analytical. Systems, tradeoffs, the smart next move.' },
  { key: 'drill_sergeant', emoji: '🪖', title: 'Drill Sergeant', desc: 'Blunt and intense. Zero excuses. Pushes you hard.' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [persona, setPersona] = useState('balanced');
  const [averageDay, setAverageDay] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    waitForSession().then(async (session) => {
      if (!session) { window.location.href = '/auth'; return; }
      const id = session.user.id;
      setUserId(id);
      try {
        const res = await fetch('/api/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, action: 'load' }),
        });
        const data = await res.json();
        setPersona(data.persona || 'balanced');
        setAverageDay(data.averageDay || '');
      } catch { /* ignore */ }
      setLoaded(true);
    });
  }, []);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'save', persona, averageDay: averageDay.trim() }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function signOut() {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }

  if (!loaded) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - var(--kb, 0px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'max(18px, env(safe-area-inset-top)) 18px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={() => router.push('/app')} style={{ color: C.muted, fontSize: 14, fontWeight: 600 }}>← Home</button>
        <h1 className="serif" style={{ fontSize: 20, fontWeight: 600, margin: 0, flex: 1, textAlign: 'center', paddingRight: 50 }}>Settings</h1>
      </div>

      <div className="scrollarea no-scrollbar" style={{ flex: 1, minHeight: 0, padding: 20, paddingBottom: 'calc(56px + env(safe-area-inset-bottom) + 20px)' }}>
        {/* Persona */}
        <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted, marginBottom: 6 }}>Adaptive voice</div>
        <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 14px', lineHeight: 1.5 }}>
          How should Ascend talk to you? This shifts the tone everywhere — coaching, day plans, and interventions.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {PERSONAS.map((p) => (
            <button key={p.key} onClick={() => setPersona(p.key)}
              style={{
                textAlign: 'left', padding: '15px 16px', borderRadius: 15, display: 'flex', gap: 13, alignItems: 'flex-start',
                background: persona === p.key ? C.orangeSoft : '#fff',
                border: `1.5px solid ${persona === p.key ? C.orange : C.border}`,
              }}>
              <span style={{ fontSize: 24 }}>{p.emoji}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700, fontFamily: SERIF, color: C.dark }}>{p.title}</span>
                <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{p.desc}</span>
              </span>
              {persona === p.key && <span style={{ color: C.orange, fontSize: 18 }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Average day */}
        <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.muted, marginBottom: 6 }}>Your average day</div>
        <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
          Tell Ascend what a typical day looks like — classes, work hours, commute, when you&apos;re free. Plans get built around your real life.
        </p>
        <textarea value={averageDay} onChange={(e) => setAverageDay(e.target.value)} rows={5}
          placeholder="e.g. Classes 9am–3pm weekdays, gym is free after 6pm, weekends are open. I'm useless before coffee and most focused at night."
          style={{ width: '100%', padding: '14px 15px', borderRadius: 14, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none' }} />

        <div style={{ marginTop: 20 }}>
          <PrimaryButton onClick={save} loading={saving}>{saved ? 'Saved ✓' : 'Save settings'}</PrimaryButton>
        </div>

        <button onClick={signOut} style={{ marginTop: 28, width: '100%', padding: '13px', borderRadius: 13, background: C.sand, color: C.muted, fontWeight: 600, fontSize: 14 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
