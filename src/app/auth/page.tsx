'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'otp';

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const sendOTP = async () => {
    if (!email.trim()) return;
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
    });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setStep('otp');
  };

  const verifyOTP = async () => {
    if (otp.length < 6) return;
    setLoading(true); setError('');
    const { data, error: e } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    });
    if (e) { setError(e.message); setLoading(false); return; }
    if (!data.user) { setError('Verification failed. Try again.'); setLoading(false); return; }

    // Check onboarded
    const { data: profile } = await supabase
      .from('profiles').select('onboarded').eq('id', data.user.id).single();
    router.replace(profile?.onboarded ? '/app' : '/onboard');
  };

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%' }}>

        {/* Logo */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:40 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <svg width="34" height="34" viewBox="0 0 38 38" fill="none">
              <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:28, fontWeight:700, color:'#1A1815', letterSpacing:'-0.5px' }}>ASCEND</div>
          <div style={{ fontSize:13, color:'#6B6359', marginTop:6, textAlign:'center' }}>Your cognitive partner</div>
        </div>

        {step === 'email' && (
          <>
            <div style={{ fontSize:18, fontWeight:700, color:'#1A1815', marginBottom:6, fontFamily:'Georgia,serif' }}>
              Sign in or create account
            </div>
            <div style={{ fontSize:13, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>
              We'll send a 6-digit code to your email. No password needed.
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOTP()}
              placeholder="your@email.com"
              style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:16, color:'#1A1815', outline:'none', marginBottom:12 }}
            />
            {error && <div style={{ fontSize:12, color:'#D9531E', marginBottom:10 }}>{error}</div>}
            <button onClick={sendOTP} disabled={!email.trim() || loading} className="btn-primary">
              {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <><span>Send code</span><ArrowRight size={16} /></>}
            </button>
          </>
        )}

        {step === 'otp' && (
          <>
            <button onClick={() => setStep('email')} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:'#6B6359', fontSize:13, marginBottom:20, padding:0 }}>
              <ChevronLeft size={16} /> Back
            </button>
            <div style={{ fontSize:18, fontWeight:700, color:'#1A1815', marginBottom:6, fontFamily:'Georgia,serif' }}>
              Check your email
            </div>
            <div style={{ fontSize:13, color:'#6B6359', marginBottom:20, lineHeight:1.5 }}>
              We sent a sign-in code to <strong>{email}</strong>
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 10))}
              onKeyDown={e => e.key === 'Enter' && verifyOTP()}
              placeholder="Enter your code"
              style={{ width:'100%', padding:'16px', borderRadius:14, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:24, fontWeight:700, color:'#1A1815', outline:'none', textAlign:'center', marginBottom:12 }}
            />
            {error && <div style={{ fontSize:12, color:'#D9531E', marginBottom:10 }}>{error}</div>}
            <button onClick={verifyOTP} disabled={otp.length < 4 || loading} className="btn-primary">
              {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <><span>Verify</span><ArrowRight size={16} /></>}
            </button>
            <button onClick={sendOTP} style={{ marginTop:14, background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#A8A095', width:'100%', textAlign:'center' }}>
              Didn't receive it? Resend code
            </button>
          </>
        )}
      </div>
    </div>
  );
}
