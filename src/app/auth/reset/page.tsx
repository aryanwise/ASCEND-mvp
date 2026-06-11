'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const reset = async () => {
    if (password.length < 6) { setError('Min 6 characters'); return; }
    setLoading(true); setError('');
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setDone(true);
    setTimeout(() => router.replace('/app'), 2000);
  };

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%' }}>
        <div style={{ fontFamily:'Georgia,serif', fontSize:24, fontWeight:700, color:'#1A1815', marginBottom:8 }}>Set new password</div>
        <div style={{ fontSize:14, color:'#6B6359', marginBottom:24 }}>Choose something you'll remember.</div>

        {done ? (
          <div style={{ textAlign:'center', fontSize:15, fontWeight:700, color:'#1B7A5C' }}>✓ Password updated — redirecting...</div>
        ) : (
          <>
            <div style={{ position:'relative', marginBottom:16 }}>
              <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                style={{ width:'100%', padding:'14px 48px 14px 16px', borderRadius:12, border:'1px solid rgba(26,24,21,0.12)', background:'#fff', fontSize:16, color:'#1A1815', outline:'none' }} />
              <button onClick={()=>setShowPass(s=>!s)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
                {showPass ? <EyeOff size={18} color="#A8A095" /> : <Eye size={18} color="#A8A095" />}
              </button>
            </div>
            {error && <div style={{ fontSize:12, color:'#D9531E', marginBottom:12 }}>{error}</div>}
            <button onClick={reset} disabled={!password.trim()||loading} className="btn-primary">
              {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <><span>Update password</span><ArrowRight size={16} /></>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}