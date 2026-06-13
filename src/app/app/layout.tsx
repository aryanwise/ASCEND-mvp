'use client';
import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { waitForSession, isStandalone } from '@/lib/session';
import { C } from '@/lib/design';
import { FullLoader, BodyPortal } from '@/components/ui';

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
  const router = useRouter();

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

  // Track how much the keyboard covers (the "keyboard inset") and expose it as
  // --kb so the chat input / sheets can lift to sit just above the keyboard —
  // like Gemini — WITHOUT shrinking the whole shell (which made the nav float).
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      document.documentElement.style.setProperty('--kb', `${inset}px`);
      window.scrollTo(0, 0);
    };

    // iOS fires the resize event before the keyboard finishes animating, so a
    // single read gives a stale (often 0) inset and the input doesn't move until
    // the user scrolls. Sample several times across the animation to catch the
    // final height immediately on focus.
    const sampleBurst = () => {
      update();
      let n = 0;
      const tick = () => {
        update();
        if (++n < 8) setTimeout(tick, 60); // ~0.5s of catching the animation
      };
      requestAnimationFrame(tick);
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    // When any input/textarea gains focus, run the burst so the lift is instant.
    document.addEventListener('focusin', sampleBurst);
    document.addEventListener('focusout', sampleBurst);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', sampleBurst);
      document.removeEventListener('focusout', sampleBurst);
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

  // Client-side navigation between tabs — no full page reload, so switching is
  // instant (the session race we used window.location for only affects auth
  // events, not tab-to-tab nav where the session already exists).
  const go = (href: string) => { router.push(href); };
  const activeKey =
    pathname === '/app' ? 'home'
    : pathname.startsWith('/app/goals') ? 'goals'
    : pathname.startsWith('/app/coach') ? 'coach'
    : pathname.startsWith('/app/assistant') ? 'assistant'
    : pathname.startsWith('/app/insights') ? 'insights'
    : '';

  return (
    <div className="shell" style={{ touchAction: 'pan-y' }}>
      <div className="scrollarea no-scrollbar" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>{children}</div>

      <BodyPortal>
        <div style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, zIndex: 50,
          width: '100%', maxWidth: 430,
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(248,245,239,0.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}>
          {TABS.map((t) => (
            <NavBtn key={t.key} label={t.label} active={activeKey === t.key} tabKey={t.key} onClick={() => go(t.href)} />
          ))}
        </div>
      </BodyPortal>
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
