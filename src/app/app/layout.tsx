'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { waitForSession, isStandalone } from '@/lib/session';
import { C } from '@/lib/design';
import { FullLoader } from '@/components/ui';

const TABS = [
  { key: 'home', label: 'Home', href: '/app' },
  { key: 'goals', label: 'Goals', href: '/app/goals' },
  { key: 'coach', label: 'Coach', href: '/app/coach' },
  { key: 'assistant', label: 'Assistant', href: '/app/assistant' },
  { key: 'insights', label: 'Insights', href: '/app/insights' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const session = await waitForSession();
      if (!session) {
        window.location.href = isStandalone() ? '/auth' : '/install';
        return;
      }
      const id = session.user.id;

      const justOnboarded =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('onboarded') === '1';
      if (justOnboarded) {
        window.history.replaceState({}, '', '/app');
        setReady(true);
        return;
      }

      let onboarded = false;
      try {
        const res = await fetch('/api/profile-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id }),
        });
        const data = await res.json();
        onboarded = !!data.onboarded;
      } catch {
        onboarded = true;
      }

      if (!onboarded) { window.location.href = '/onboard'; return; }
      setReady(true);
    })();
  }, []);

  // Lock the shell to the ACTUAL visible viewport. iOS PWAs don't reliably honor
  // dvh/svh when the keyboard opens — the page scrolls and pushes the nav off
  // screen. visualViewport reports the true visible height (shrinking when the
  // keyboard appears), so we set it as a CSS var the shell uses for its height.
  useEffect(() => {
    const setVH = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-vh', `${h}px`);
      // Keep the window pinned to top so the keyboard can't scroll the shell away.
      window.scrollTo(0, 0);
    };
    setVH();
    window.visualViewport?.addEventListener('resize', setVH);
    window.visualViewport?.addEventListener('scroll', setVH);
    window.addEventListener('resize', setVH);
    return () => {
      window.visualViewport?.removeEventListener('resize', setVH);
      window.visualViewport?.removeEventListener('scroll', setVH);
      window.removeEventListener('resize', setVH);
    };
  }, []);

  // Disable horizontal swipe-back/forward gesture — this is an app, not a webpage.
  // In a standalone PWA the edge swipe walks the history stack; we block any
  // touch gesture that starts near the left/right screen edge and moves mostly
  // horizontally, which is what triggers back/forward.
  useEffect(() => {
    const EDGE = 32; // px from either edge that counts as an "edge swipe"
    let startX = 0;
    let startY = 0;
    let fromEdge = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      fromEdge = startX <= EDGE || startX >= window.innerWidth - EDGE;
    };
    const onMove = (e: TouchEvent) => {
      if (!fromEdge) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      // Mostly-horizontal drag that began at the edge -> kill it.
      if (dx > dy && dx > 8 && e.cancelable) e.preventDefault();
    };

    document.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });

    const prevB = document.body.style.overscrollBehaviorX;
    const prevH = document.documentElement.style.overscrollBehaviorX;
    document.body.style.overscrollBehaviorX = 'none';
    document.documentElement.style.overscrollBehaviorX = 'none';

    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.body.style.overscrollBehaviorX = prevB;
      document.documentElement.style.overscrollBehaviorX = prevH;
    };
  }, []);

  if (!ready) return <FullLoader />;

  const go = (href: string) => { window.location.href = href; };
  const activeKey =
    pathname === '/app' ? 'home'
    : pathname.startsWith('/app/goals') ? 'goals'
    : pathname.startsWith('/app/coach') ? 'coach'
    : pathname.startsWith('/app/assistant') ? 'assistant'
    : pathname.startsWith('/app/insights') ? 'insights'
    : '';

  return (
    <div className="shell" style={{ touchAction: 'pan-y' }}>
      <div className="scrollarea no-scrollbar" style={{ paddingBottom: 68 }}>{children}</div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
        height: 'calc(56px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(248,245,239,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        {TABS.map((t) => (
          <NavBtn key={t.key} label={t.label} active={activeKey === t.key} tabKey={t.key} onClick={() => go(t.href)} />
        ))}
      </div>
    </div>
  );
}

function NavBtn({ label, active, tabKey, onClick }: { label: string; active: boolean; tabKey: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, padding: '6px 0' }}>
      <Icon name={tabKey} active={active} />
      <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? C.orange : C.faint }}>{label}</span>
    </button>
  );
}

function Icon({ name, active }: { name: string; active: boolean }) {
  const col = active ? C.orange : C.faint;
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: col, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (<svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>);
    case 'goals':
      return (<svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>);
    case 'coach':
      return (<svg {...common}><path d="M4 5h16v11H8l-4 4z" /></svg>);
    case 'assistant':
      return (<svg {...common}><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 7V4" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /></svg>);
    case 'insights':
      return (<svg {...common}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M21 20H3" /></svg>);
    default:
      return null;
  }
}
