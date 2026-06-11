'use client';
import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSent(true);
  };

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%' }}>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:40 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
            <svg width="36" height="36" viewBox="0 0 38 38" fill="none">
              <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:30, fontWeight:700, color:'#1A1815' }}>ASCEND</div>
          <div style={{ fontSize:14, color:'#6B6359', marginTop:6 }}>Your cognitive partner</div>
        </div>

        {!sent ? (
          <>
            <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1815', marginBottom:8 }}>
              Get started
            </div>
            <div style={{ fontSize:14, color:'#6B6359', marginBottom:24, lineHeight:1.6 }}>
              Enter your email — we'll send you a secure sign-in link. No password needed.
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="your@email.com"
              style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:16, color:'#1A1815', outline:'none', marginBottom:12 }}
            />
            {error && <div style={{ fontSize:12, color:'#D9531E', marginBottom:10 }}>{error}</div>}
            <button onClick={send} disabled={!email.trim() || loading} className="btn-primary">
              {loading
                ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} />
                : <><span>Send sign-in link</span><ArrowRight size={16} /></>
              }
            </button>
          </>
        ) : (
          <div className="fade-up" style={{ textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#FFE9DD', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <Mail size={28} color="#D9531E" />
            </div>
            <div style={{ fontFamily:'Georgia,serif', fontSize:22, fontWeight:700, color:'#1A1815', marginBottom:12 }}>
              Check your email
            </div>
            <div style={{ fontSize:14, color:'#6B6359', lineHeight:1.7, marginBottom:24 }}>
              We sent a sign-in link to<br /><strong style={{ color:'#1A1815' }}>{email}</strong><br /><br />
              Click the link in the email to continue. You can close this tab.
            </div>
            <button onClick={() => setSent(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#A8A095' }}>
              Wrong email? Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}