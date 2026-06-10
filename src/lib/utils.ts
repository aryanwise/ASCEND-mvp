export const QUOTES = [
  'The plan flexes. You don\'t break.',
  'Missed yesterday. Today still counts.',
  'Consistency over intensity. Always.',
  'Small moves, compounding daily.',
  'Recalibrate. Don\'t quit.',
  'Progress is non-linear. Keep going.',
  'The goal hasn\'t changed. The path did.',
  'Show up imperfectly. Still counts.',
  'One task done beats ten planned.',
  'Discipline is remembering what you want.',
  'You\'re building a system, not chasing perfection.',
  'Hard days are part of the data.',
];

export const getQuote = (i: number) => QUOTES[i % QUOTES.length];

// ── Push ────────────────────────────────────────────────────
export const registerSW = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); }
  catch { return null; }
};

export const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

function toUint8(b64: string) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export const subscribePush = async (reg: ServiceWorkerRegistration, userId: string) => {
  try {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(key) });
    const j = sub.toJSON();
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }),
    });
  } catch { /* push not critical */ }
};
