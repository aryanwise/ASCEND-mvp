'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { detectPlatform, isInstalled } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function Install() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const platform = detectPlatform();

  useEffect(() => {
  if (loading) return;
  if (!user) {
    router.replace('/auth');
    return;
  }
  const check = async () => {
    try {
      const { data } = await supabase
        .from('profiles').select('onboarded').eq('id', user.id).single();
      // Skip install entirely — go straight to onboard or app
      router.replace(data?.onboarded ? '/app' : '/onboard');
    } catch {
      router.replace('/onboard');
    }
  };
  check();
}, [user, loading, router]);

  const proceed = () => router.replace('/onboard');

  return (
    <div className="shell" style={{ alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div className="fade-up" style={{ width:'100%' }}>

        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'#D9531E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
              <path d="M10 28L19 10L28 28" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.5 22H23.5" stroke="#F8F5EF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:26, fontWeight:700, color:'#1A1815', marginBottom:8 }}>
            Add Ascend to your home screen
          </div>
          <div style={{ fontSize:14, color:'#6B6359', lineHeight:1.6 }}>
            This step is required for push notifications and the full app experience.
          </div>
        </div>

        {/* Benefits */}
        {['Feels like a native app — no browser bars', 'Push notifications for your goals', 'Works offline for your day plan'].map((text, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'#FFE9DD', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Check size={14} color="#D9531E" />
            </div>
            <span style={{ fontSize:14, color:'#1A1815' }}>{text}</span>
          </div>
        ))}

        <div style={{ height:1, background:'rgba(26,24,21,0.08)', margin:'20px 0' }} />

        {platform === 'ios' && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:14 }}>How to install on iPhone</div>
            {[
              ['1', 'Tap the Share button', '⬆️ at the bottom of Safari'],
              ['2', 'Scroll down and tap', '"Add to Home Screen"'],
              ['3', 'Tap', '"Add" in the top right'],
            ].map(([n, a, b]) => (
              <div key={n} style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'#1A1815', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{n}</span>
                </div>
                <div style={{ fontSize:14, color:'#1A1815', paddingTop:4, lineHeight:1.4 }}>{a} <span style={{ fontWeight:700 }}>{b}</span></div>
              </div>
            ))}
          </div>
        )}

        {platform === 'android' && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#D9531E', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:14 }}>How to install on Android</div>
            {[
              ['1', 'Tap the menu', '⋮ in Chrome'],
              ['2', 'Tap', '"Add to Home screen"'],
              ['3', 'Tap', '"Add"'],
            ].map(([n, a, b]) => (
              <div key={n} style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:'#1A1815', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{n}</span>
                </div>
                <div style={{ fontSize:14, color:'#1A1815', paddingTop:4, lineHeight:1.4 }}>{a} <span style={{ fontWeight:700 }}>{b}</span></div>
              </div>
            ))}
          </div>
        )}

        {platform === 'desktop' && (
          <div style={{ background:'#FFE9DD', borderRadius:12, padding:'12px 14px', marginBottom:24 }}>
            <div style={{ fontSize:13, color:'#B33E0E', lineHeight:1.5 }}>
              Open this link on your phone to install the app. The full experience is designed for mobile.
            </div>
          </div>
        )}

        <button onClick={proceed} className="btn-primary">
          I've added it to my home screen <ChevronRight size={16} />
        </button>

        <div style={{ textAlign:'center', marginTop:14, fontSize:12, color:'#A8A095' }}>
          Already installed? Tap above to continue.
        </div>
      </div>
    </div>
  );
}