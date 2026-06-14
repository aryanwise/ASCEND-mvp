// Theme preference: 'light' | 'dark' | 'system'. Stored in a cookie so the
// no-flash script in the root layout can read it before first paint.
export type ThemePref = 'light' | 'dark' | 'system';

export function getThemePref(): ThemePref {
  if (typeof document === 'undefined') return 'system';
  const m = document.cookie.match(/(?:^|; )ascend-theme=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : 'system';
  return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolve(pref));
}

export function setThemePref(pref: ThemePref) {
  // 1 year cookie
  document.cookie = `ascend-theme=${encodeURIComponent(pref)}; path=/; max-age=31536000; samesite=lax`;
  applyTheme(pref);
}

// Keep 'system' choice live if the OS theme flips while the app is open.
export function watchSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => { if (getThemePref() === 'system') applyTheme('system'); };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
