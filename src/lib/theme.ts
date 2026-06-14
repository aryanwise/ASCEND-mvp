// Theme preference: 'light' | 'dark' | 'system'. Stored in a cookie so the
// no-flash script in the root layout can read it before first paint.
export type ThemePref = 'light' | 'dark';

export function getThemePref(): ThemePref {
  if (typeof document === 'undefined') return 'light';
  const m = document.cookie.match(/(?:^|; )ascend-theme=([^;]+)/);
  const v = m ? decodeURIComponent(m[1]) : 'light';
  return v === 'dark' ? 'dark' : 'light';
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  return pref === 'dark' ? 'dark' : 'light';
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

// No 'system' mode anymore — theme is an explicit light/dark choice.
export function watchSystemTheme() {
  return () => {};
}
