'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/design';
import { Logo, PrimaryButton } from '@/components/ui';

export default function AuthPage() {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resent, setResent] = useState(false);

  function validEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function sendCode(isResend = false) {
    setErr('');
    const e = email.trim().toLowerCase();
    if (!validEmail(e)) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    // shouldCreateUser:true => same call signs up new users AND logs in existing ones.
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEmail(e);
    setStage('code');
    if (isResend) { setResent(true); setTimeout(() => setResent(false), 3000); }
  }

  async function verify() {
    setErr('');
    const token = code.trim();
    if (token.length < 6) { setErr('Enter the 6-digit code from your email.'); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    if (error || !data.session) {
      setBusy(false);
      setErr(error?.message || 'That code didn\'t work. Try again.');
      return;
    }
    // Session is now set inside the app. Route based on onboarding status.
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('id', data.session.user.id)
      .maybeSingle();
    window.location.href = profile?.onboarded ? '/app' : '/onboard';
  }

  return (
    <div className="shell">
      <div className="scrollarea" style={{ padding: '0 24px' }}>
        <div style={{ paddingTop: 'max(72px, env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Logo size={56} />
          <div className="serif" style={{ fontSize: 34, fontWeight: 600, letterSpacing: '0.03em' }}>Ascend</div>
          <div style={{ color: C.muted, fontSize: 15, textAlign: 'center', maxWidth: 290, lineHeight: 1.5 }}>
            {stage === 'email'
              ? 'Sign in with your email. We\'ll send you a code — no password needed.'
              : `Enter the 6-digit code we sent to ${email}.`}
          </div>
        </div>

        {stage === 'email' ? (
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              placeholder="you@email.com"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              style={inputStyle}
            />
            {err && <div style={{ color: '#C62828', fontSize: 13.5 }}>{err}</div>}
            <PrimaryButton onClick={() => sendCode()} loading={busy}>Send me a code</PrimaryButton>
          </div>
        ) : (
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.4em', fontSize: 22, fontWeight: 600 }}
            />
            {err && <div style={{ color: '#C62828', fontSize: 13.5 }}>{err}</div>}
            {resent && <div style={{ color: C.muted, fontSize: 13 }}>New code sent.</div>}
            <PrimaryButton onClick={verify} loading={busy}>Verify &amp; continue</PrimaryButton>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => { setStage('email'); setCode(''); setErr(''); }} style={{ color: C.muted, fontSize: 13.5 }}>← Change email</button>
              <button onClick={() => sendCode(true)} style={{ color: C.orange, fontSize: 13.5, fontWeight: 600 }}>Resend code</button>
            </div>
          </div>
        )}
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
