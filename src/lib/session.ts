import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Reliably get the session after a hard navigation (window.location.href).
// The Supabase client rehydrates from storage asynchronously, so an immediate
// getSession() can return null on the first tick. We retry briefly and also
// listen for the auth state to settle. This kills the "/app bounces to /onboard"
// race where the guard reads a null/empty session too early.
export function waitForSession(timeoutMs = 4000): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (s: Session | null) => {
      if (settled) return;
      settled = true;
      sub.data.subscription.unsubscribe();
      clearInterval(poll);
      clearTimeout(timer);
      resolve(s);
    };

    // 1) Immediate check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session);
    });

    // 2) Listen for hydration / sign-in events
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });

    // 3) Poll as a backstop (covers the gap before onAuthStateChange fires)
    const poll = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) finish(data.session);
    }, 250);

    // 4) Give up after timeout -> truly no session
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

// PWA standalone detection
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}
