'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { detectPlatform, isInstalled } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export default function Root() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showInstall, setShowInstall] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    if (loading) return;

    // Logged in — skip install, go straight to app
    if (user) {
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
      return;
    }

    // Not logged in — show install if not already installed
    if (isInstalled()) {
      router.replace('/auth');
    } else {
      setShowInstall(true);
    }
  }, [user, loading, router]);

  if (loading || !showInstall) {
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

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%', textAlign:'center' }}>

        <div style={{ width:72, height:72, borderRadius:20, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
            <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>

        <div style={{ fontFamily:'Georgia,serif', fontSize:32, fontWeight:700, color:'#1A1815', marginBottom:8 }}>ASCEND</div>
        <div style={{ fontSize:14, color:'#6B6359', marginBottom:36, lineHeight:1.6 }}>Your cognitive partner</div>

        {platform === 'ios' && (
          <div className="card" style={{ marginBottom:24, textAlign:'left' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:12 }}>Add to iPhone home screen</div>
            {[['1','Tap Share ⬆️','in Safari'],['2','Tap','Add to Home Screen'],['3','Tap','Add']].map(([n,a,b]) => (
              <div key={n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{n}</span>
                </div>
                <span style={{ fontSize:14, color:'#1A1815' }}>{a} <strong>{b}</strong></span>
              </div>
            ))}
          </div>
        )}

        {platform === 'android' && (
          <div className="card" style={{ marginBottom:24, textAlign:'left' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:12 }}>Add to Android home screen</div>
            {[['1','Tap menu ⋮','in Chrome'],['2','Tap','Add to Home screen'],['3','Tap','Add']].map(([n,a,b]) => (
              <div key={n} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{n}</span>
                </div>
                <span style={{ fontSize:14, color:'#1A1815' }}>{a} <strong>{b}</strong></span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => router.push('/auth')} className="btn-primary">
          {isInstalled() ? 'Continue' : 'Skip for now'} <ChevronRight size={16} />
        </button>

        <div style={{ fontSize:12, color:'#A8A095', marginTop:16 }}>
          Push notifications only work after installing
        </div>
      </div>
    </div>
  );
}