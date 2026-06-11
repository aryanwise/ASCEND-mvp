'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSession } from '@/lib/session';
import { C, SERIF, AREA_LIST, ARCHETYPES } from '@/lib/design';
import { Logo, PrimaryButton, Spinner } from '@/components/ui';

type Step = 'profile' | 'archetype' | 'goal_area' | 'conversation' | 'motivation';
interface Turn { role: 'assistant' | 'user'; content: string; }

export default function OnboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const stepsList: Step[] = ['profile', 'archetype', 'goal_area', 'conversation', 'motivation'];
  const [stepIdx, setStepIdx] = useState(0);
  const step = stepsList[stepIdx];

  // profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  // archetype
  const [archetype, setArchetype] = useState('');
  // goal
  const [areaKey, setAreaKey] = useState('');
  const [goalText, setGoalText] = useState('');
  // conversation
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [convoDone, setConvoDone] = useState(false);
  const [contextSummary, setContextSummary] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  // motivation
  const [motivation, setMotivation] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    waitForSession().then((session) => {
      if (!session) { window.location.href = '/auth'; return; }
      setUserId(session.user.id);
    });
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, thinking]);

  async function startConversation() {
    setThinking(true);
    setErr('');
    setTurns([]);
    setConvoDone(false);
    setContextSummary('');
    try {
      const res = await fetch('/api/onboard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: areaKey, goal: goalText, firstName, history: [] }),
      });
      const data = await res.json();
      if (data.message) setTurns([{ role: 'assistant', content: data.message }]);
      if (data.done) { setConvoDone(true); setContextSummary(data.context_summary || ''); }
    } catch {
      setErr('Could not start the conversation. Try again.');
    }
    setThinking(false);
  }

  async function sendChat() {
    const content = chatInput.trim();
    if (!content || thinking || convoDone) return;
    setChatInput('');
    const nextTurns: Turn[] = [...turns, { role: 'user', content }];
    setTurns(nextTurns);
    setThinking(true);
    try {
      const res = await fetch('/api/onboard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: areaKey, goal: goalText, firstName, history: nextTurns }),
      });
      const data = await res.json();
      if (data.message) setTurns([...nextTurns, { role: 'assistant', content: data.message }]);
      if (data.done) { setConvoDone(true); setContextSummary(data.context_summary || ''); }
    } catch {
      setTurns([...nextTurns, { role: 'assistant', content: 'Hmm, I lost my train of thought — say that once more?' }]);
    }
    setThinking(false);
  }

  async function next() {
    setErr('');
    if (step === 'profile') {
      if (!firstName.trim() || !lastName.trim()) { setErr('Enter your first and last name.'); return; }
      setStepIdx(1);
    } else if (step === 'archetype') {
      if (!archetype) { setErr('Pick the one that fits best.'); return; }
      setStepIdx(2);
    } else if (step === 'goal_area') {
      if (!areaKey) { setErr('Pick a goal area.'); return; }
      if (goalText.trim().length < 6) { setErr('Describe your goal a bit more.'); return; }
      setStepIdx(3);
      await startConversation();
    } else if (step === 'conversation') {
      if (!convoDone) { setErr('Finish chatting with your coach first — just a couple more replies.'); return; }
      setStepIdx(4);
    } else if (step === 'motivation') {
      await finish();
    }
  }

  function back() {
    setErr('');
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function finish() {
    if (!userId) return;
    if (motivation.trim().length < 4) { setErr('A real reason will keep you going — write it down.'); return; }
    setBusy(true);
    try {
      const pRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, first_name: firstName.trim(), last_name: lastName.trim(),
          age: age ? parseInt(age, 10) : null, archetype,
        }),
      });
      if (!pRes.ok) { const d = await pRes.json().catch(() => ({})); throw new Error(d.error || 'Could not save your profile.'); }

      const summary = contextSummary || turns.map((t) => `${t.role}: ${t.content}`).join(' | ');
      const gRes = await fetch('/api/goals/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, area: areaKey, goal: goalText, contextSummary: summary,
          motivation: motivation.trim(), archetype, markOnboarded: true,
        }),
      });
      if (!gRes.ok) { const d = await gRes.json().catch(() => ({})); throw new Error(d.error || 'Could not build your plan.'); }

      window.location.href = '/app?onboarded=1';
    } catch (e) {
      setErr((e as Error).message || 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div style={{ padding: 'max(24px, env(safe-area-inset-top)) 24px 0' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {stepsList.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIdx ? C.orange : C.sand }} />
          ))}
        </div>
      </div>

      <div className="scrollarea no-scrollbar fadein" key={step} style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {step === 'profile' && (
          <Section title="Let's get to know you" subtitle="First, the basics.">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={inp} />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={inp} />
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} placeholder="Age (optional)" inputMode="numeric" style={inp} />
          </Section>
        )}

        {step === 'archetype' && (
          <Section title="How does your life run?" subtitle="This shapes how Ascend schedules you.">
            {ARCHETYPES.map((a) => (
              <button key={a.key} onClick={() => setArchetype(a.key)} style={selectCard(archetype === a.key)}>
                <div style={{ fontWeight: 700, fontSize: 16, fontFamily: SERIF }}>{a.title}</div>
                <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>{a.desc}</div>
              </button>
            ))}
          </Section>
        )}

        {step === 'goal_area' && (
          <Section title="What do you want to change?" subtitle="Pick an area, then describe it.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {AREA_LIST.map((a) => (
                <button key={a.key} onClick={() => setAreaKey(a.key)}
                  style={{
                    padding: '12px 6px', borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: areaKey === a.key ? a.soft : '#fff',
                    border: `1.5px solid ${areaKey === a.key ? a.color : C.border}`,
                  }}>
                  <span style={{ fontSize: 22 }}>{a.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.dark }}>{a.label}</span>
                </button>
              ))}
            </div>
            <textarea value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={3}
              placeholder="e.g. Run a half marathon in 4 months without injuring my knee again"
              style={{ ...inp, marginTop: 12 }} />
          </Section>
        )}

        {step === 'conversation' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ marginBottom: 6 }}><Logo size={32} /></div>
            <h1 className="serif" style={{ fontSize: 24, fontWeight: 600, margin: '6px 0 14px' }}>Let&apos;s talk it through</h1>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }} className="no-scrollbar">
              {turns.map((t, i) => (
                <div key={i} className="fadein" style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '11px 15px', borderRadius: 18, fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    background: t.role === 'user' ? C.orange : '#fff',
                    color: t.role === 'user' ? '#fff' : C.dark,
                    border: t.role === 'user' ? 'none' : `1px solid ${C.border}`,
                    borderBottomRightRadius: t.role === 'user' ? 5 : 18,
                    borderBottomLeftRadius: t.role === 'user' ? 18 : 5,
                  }}>{t.content}</div>
                </div>
              ))}
              {thinking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '13px 17px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 18, borderBottomLeftRadius: 5, display: 'flex', gap: 5 }}>
                    {[0, 1, 2].map((d) => (<span key={d} className="dot" style={{ width: 7, height: 7, borderRadius: '50%', background: C.faint }} />))}
                  </div>
                </div>
              )}
              {convoDone && (
                <div className="fadein" style={{ textAlign: 'center', fontSize: 13, color: C.muted, padding: '8px 0' }}>
                  ✓ Got everything I need — tap Continue below.
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {!convoDone && (
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', paddingTop: 12 }}>
                <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  rows={1} placeholder="Type your reply…"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 16, border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none', maxHeight: 110 }} />
                <button onClick={sendChat} disabled={!chatInput.trim() || thinking}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: chatInput.trim() ? C.orange : C.faint, color: '#fff', fontSize: 19, flexShrink: 0 }}>↑</button>
              </div>
            )}
          </div>
        )}

        {step === 'motivation' && (
          <Section title="Why does this matter?" subtitle="Ascend will remind you of this when it gets hard.">
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4}
              placeholder="The real reason behind this goal…" style={inp} />
          </Section>
        )}

        {err && <div style={{ color: '#C62828', fontSize: 13.5, marginTop: 10 }}>{err}</div>}
      </div>

      <div style={{ padding: '12px 24px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: 10, borderTop: `1px solid ${C.border}` }}>
        {stepIdx > 0 && (
          <button onClick={back} style={{ padding: '15px 22px', borderRadius: 14, background: C.sand, color: C.dark, fontWeight: 600 }}>Back</button>
        )}
        <div style={{ flex: 1 }}>
          <PrimaryButton onClick={next} loading={busy || (step === 'conversation' && thinking && turns.length === 0)}>
            {step === 'motivation' ? 'Build my plan' : 'Continue'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}><Logo size={34} /></div>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: '8px 0 4px' }}>{title}</h1>
      <p style={{ color: C.muted, fontSize: 14.5, margin: '0 0 20px' }}>{subtitle}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '14px 15px', borderRadius: 13,
  border: `1px solid ${C.border}`, background: '#fff', fontSize: 16, outline: 'none',
};

function selectCard(active: boolean): React.CSSProperties {
  return {
    width: '100%', textAlign: 'left', padding: '15px 16px', borderRadius: 14,
    background: active ? C.orangeSoft : '#fff',
    border: `1.5px solid ${active ? C.orange : C.border}`,
  };
}