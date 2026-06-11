'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { waitForSession, isStandalone } from '@/lib/session';
import { C } from '@/lib/design';
import { FullLoader } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const session = await waitForSession();
      if (!session) {
        window.location.href = isStandalone() ? '/auth' : '/install';
        return;
      }
      const id = session.user.id;

      let onboarded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarded')
          .eq('id', id)
          .maybeSingle();
        if (profile) { onboarded = !!profile.onboarded; break; }
        await new Promise((r) => setTimeout(r, 350));
      }

      if (!onboarded) { window.location.href = '/onboard'; return; }
      setReady(true);
    })();
  }, []);

  useEffect(() => { setFabOpen(false); }, [pathname]);

  if (!ready) return <FullLoader />;

  const go = (href: string) => { window.location.href = href; };
  const isHome = pathname === '/app';
  const isGoals = pathname === '/app/goals';

  return (
    <div className="shell">
      <div className="scrollarea no-scrollbar" style={{ paddingBottom: 86 }}>{children}</div>

      {/* FAB expanded overlay */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fadein"
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(26,24,21,0.32)', backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            padding: '0 0 110px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            {[
              { label: 'Coach', emoji: '💬', href: '/app/coach' },
              { label: 'Insights', emoji: '📊', href: '/app/insights' },
              { label: 'Reflect', emoji: '🪞', href: '/app/reflect' },
            ].map((it) => (
              <button key={it.href} onClick={() => go(it.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: 210,
                  background: '#fff', borderRadius: 16, padding: '14px 18px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontWeight: 600, fontSize: 15.5, color: C.dark,
                }}>
                <span style={{ fontSize: 20 }}>{it.emoji}</span>{it.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
        height: 'calc(72px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(248,245,239,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        <NavBtn label="Home" emoji="🏠" active={isHome} onClick={() => go('/app')} />

        <button onClick={() => setFabOpen((o) => !o)}
          style={{
            width: 58, height: 58, borderRadius: '50%', background: C.orange,
            color: '#fff', fontSize: 30, fontWeight: 300, marginTop: -22,
            boxShadow: '0 8px 20px rgba(217,83,30,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
            transition: 'transform 0.25s',
            transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}>
          +
        </button>

        <NavBtn label="Goals" emoji="🎯" active={isGoals} onClick={() => go('/app/goals')} />
      </div>
    </div>
  );
}

function NavBtn({ label, emoji, active, onClick }: { label: string; emoji: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 70, opacity: active ? 1 : 0.5 }}>
      <span style={{ fontSize: 21 }}>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.orange : C.muted }}>{label}</span>
    </button>
  );
}
