'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'signup' | 'login' | 'forgot';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>('signup');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);

  const handleSignup = async () => {
  if (!email.trim() || !password.trim()) return;
  if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
  setLoading(true); setError('');
  const { error: e } = await supabase.auth.signUp({ 
    email: email.trim().toLowerCase(), 
    password 
  });
  setLoading(false);
  if (e) { setError(e.message); return; }
  // If already in standalone (installed), skip install page
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  window.location.href = isStandalone ? '/onboard' : '/install';
};

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (e) { setError(e.message); return; }
    const { data } = await supabase.from('profiles').select('onboarded').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
    window.location.href = data?.onboarded ? '/app' : '/onboard';
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError('Enter your email first'); return; }
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSent(true);
  };

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%' }}>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <svg width="36" height="36" viewBox="0 0 38 38" fill="none">
              <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:'#1A1815' }}>ASCEND</div>
          <div style={{ fontSize:13, color:'#6B6359', marginTop:5 }}>Your cognitive partner</div>
        </div>

        {/* Tab toggle */}
        {mode !== 'forgot' && (
          <div style={{ display:'flex', background:'#EBE5D6', borderRadius:12, padding:4, marginBottom:24 }}>
            {(['signup','login'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{ flex:1, padding:'10px', borderRadius:9, background:mode===m?'#fff':'transparent', border:'none', cursor:'pointer', fontSize:14, fontWeight:mode===m?700:500, color:mode===m?'#1A1815':'#6B6359', transition:'all 0.2s' }}>
                {m === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>
        )}

        {/* Forgot password sent */}
        {mode === 'forgot' && sent ? (
          <div className="fade-up" style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>📬</div>
            <div style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1A1815', marginBottom:8 }}>Check your email</div>
            <div style={{ fontSize:14, color:'#6B6359', lineHeight:1.6, marginBottom:24 }}>We sent a password reset link to <strong>{email}</strong></div>
            <button onClick={() => { setMode('login'); setSent(false); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#D9531E', fontWeight:600 }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {mode === 'forgot' && (
              <>
                <div style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:'#1A1815', marginBottom:6 }}>Reset password</div>
                <div style={{ fontSize:14, color:'#6B6359', marginBottom:20 }}>We'll email you a link to reset it.</div>
              </>
            )}

            {/* Email */}
            <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6 }}>Email</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode==='signup'?handleSignup():mode==='login'?handleLogin():handleForgot())}
              placeholder="your@email.com"
              style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:16, color:'#1A1815', outline:'none', marginBottom:12 }}
            />

            {/* Password */}
            {mode !== 'forgot' && (
              <>
                <div style={{ fontSize:12, fontWeight:600, color:'#6B6359', marginBottom:6 }}>Password</div>
                <div style={{ position:'relative', marginBottom:16 }}>
                  <input
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (mode==='signup'?handleSignup():handleLogin())}
                    placeholder={mode==='signup' ? 'Min 6 characters' : 'Your password'}
                    style={{ width:'100%', padding:'14px 48px 14px 16px', borderRadius:12, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:16, color:'#1A1815', outline:'none' }}
                  />
                  <button onClick={() => setShowPass(s=>!s)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    {showPass ? <EyeOff size={18} color="#A8A095" /> : <Eye size={18} color="#A8A095" />}
                  </button>
                </div>
              </>
            )}

            {error && <div style={{ fontSize:12, color:'#D9531E', marginBottom:12 }}>{error}</div>}

            {/* CTA */}
            <button
              onClick={mode==='signup'?handleSignup:mode==='login'?handleLogin:handleForgot}
              disabled={!email.trim()||(mode!=='forgot'&&!password.trim())||loading}
              className="btn-primary"
            >
              {loading
                ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} />
                : <>{mode==='signup'?'Create account':mode==='login'?'Sign in':'Send reset link'} <ArrowRight size={16} /></>
              }
            </button>

            {/* Forgot password link */}
            {mode === 'login' && (
              <button onClick={() => { setMode('forgot'); setError(''); }} style={{ marginTop:16, background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#A8A095', width:'100%', textAlign:'center' }}>
                Forgot password?
              </button>
            )}

            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); setError(''); }} style={{ marginTop:16, background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#A8A095', width:'100%', textAlign:'center' }}>
                Back to sign in
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}