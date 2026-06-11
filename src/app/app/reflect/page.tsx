'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C, SERIF } from '@/lib/design';
import { PrimaryButton, Spinner } from '@/components/ui';

const BLOCKERS = ['No time', 'Low energy', 'Distracted', 'Anxious', 'Unmotivated', 'Overwhelmed', 'Forgot', 'Sick'];

export default function ReflectPage() {
  const [userId, setUserId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id;
      if (!id) { window.location.href = '/auth'; return; }
      setUserId(id);
    });
  }, []);

  function toggle(b: string) {
    setSelected((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]));
  }

  async function submit() {
    if (selected.length === 0 && !note.trim()) return;
    setLoading(true);
    setInsight('');
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, blockers: selected, note: note.trim() }),
      });
      const data = await res.json();
      setInsight(data.insight || '');
    } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 20px' }}>
      <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, margin: '0 0 6px' }}>Reflect</h1>
      <p style={{ color: C.muted, fontSize: 14.5, margin: '0 0 22px' }}>What got in the way? Honesty here is how the plan gets better.</p>

      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginBottom: 10 }}>Select what applies</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {BLOCKERS.map((b) => (
          <button key={b} onClick={() => toggle(b)} style={{
            padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: selected.includes(b) ? C.orange : '#fff',
            color: selected.includes(b) ? '#fff' : C.muted,
            border: `1.5px solid ${selected.includes(b) ? C.orange : C.border}`,
          }}>{b}</button>
        ))}
      </div>

      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Anything else on your mind…"
        style={{ width: '100%', marginTop: 18, padding: '14px 15px', borderRadius: 14, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none' }} />

      <div style={{ marginTop: 16 }}>
        <PrimaryButton onClick={submit} loading={loading} disabled={selected.length === 0 && !note.trim()}>Get honest insight</PrimaryButton>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>}

      {insight && (
        <div className="fadein" style={{ marginTop: 22, padding: '18px 20px', background: C.orangeSoft, borderRadius: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Reframe</div>
          <div style={{ fontSize: 15.5, color: C.dark, lineHeight: 1.55, fontFamily: SERIF }}>{insight}</div>
        </div>
      )}
    </div>
  );
}
