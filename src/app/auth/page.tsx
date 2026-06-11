'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/design';
import { Logo, PrimaryButton } from '@/components/ui';

export default function AuthPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function validEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function routeAfterAuth(userId: string) {
    try {
      const res = await fetch('/api/profile-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      window.location.href = data.onboarded ? '/app?onboarded=1' : '/onboard';
    } catch {
      window.location.href = '/app?onboarded=1';
    }
  }

  async function handle() {
    setErr('');
    const e = email.trim().toLowerCase();
    if (!validEmail(e)) { setErr('Enter a valid email address.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (tab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;
        if (data.session?.user) {
          await routeAfterAuth(data.session.user.id);
          return;
        }
        const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email: e, password });
        if (siErr || !si.session) {
          throw new Error('Account created. Turn OFF "Confirm email" in Supabase to log in instantly.');
        }
        await routeAfterAuth(si.session.user.id);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
        if (!data.session?.user) throw new Error('Could not sign in. Try again.');
        await routeAfterAuth(data.session.user.id);
      }
    } catch (ex) {
      const msg = (ex as Error).message || 'Something went wrong.';
      if (/already registered|already exists/i.test(msg)) {
        setErr('That email already has an account — switch to Sign In.');
      } else if (/invalid login credentials/i.test(msg)) {
        setErr('Wrong email or password.');
      } else {
        setErr(msg);
      }
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="scrollarea" style={{ padding: '0 24px' }}>
        <div style={{ paddingTop: 'max(64px, env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Logo size={56} />
          <div className="serif" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '0.03em' }}>Ascend</div>
          <div style={{ color: C.muted, fontSize: 15, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            Your cognitive partner for goals that actually stick.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, background: C.sand, borderRadius: 14, padding: 5, marginTop: 40 }}>
          {(['signin', 'signup'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErr(''); }}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 15,
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? C.dark : C.muted,
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            style={inputStyle}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle()}
            placeholder="Password"
            type="password"
            autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
            style={inputStyle}
          />
          {err && <div style={{ color: '#C62828', fontSize: 13.5, lineHeight: 1.4 }}>{err}</div>}
          <div style={{ marginTop: 6 }}>
            <PrimaryButton onClick={handle} loading={busy}>
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px 16px',
  borderRadius: 13,
  border: `1px solid ${C.border}`,
  background: '#fff',
  fontSize: 16,
  outline: 'none',
};