'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Root() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/auth'); return; }

    const check = async () => {
      try {
        const { data } = await supabase
          .from('profiles').select('onboarded').eq('id', user.id).single();
        router.replace(data?.onboarded ? '/app' : '/onboard');
      } catch {
        router.replace('/onboard');
      }
    };
    check();
  }, [user, loading, router]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background:'#F8F5EF' }}>
      <div style={{ width:56, height:56, borderRadius:14, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="32" height="32" viewBox="0 0 38 38" fill="none">
          <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}