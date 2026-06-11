'use client';
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data } = await supabase
          .from('profiles').select('onboarded').eq('id', session.user.id).single();
        if (data?.onboarded) {
          window.location.href = '/app';
        } else {
          window.location.href = '/install';
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#F8F5EF', gap:16 }}>
      <div style={{ width:56, height:56, borderRadius:14, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="32" height="32" viewBox="0 0 38 38" fill="none">
          <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <Loader2 size={20} color="#D9531E" style={{ animation:'spin 1s linear infinite' }} />
      <div style={{ fontSize:14, color:'#6B6359' }}>Signing you in...</div>
    </div>
  );
}