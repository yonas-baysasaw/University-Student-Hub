export const THEME_STORAGE_KEY = 'ush-theme';

/** @returns {'light' | 'dark' | 'system'} */
export function getStoredThemePreference() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

function resolveDark(pref) {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Apply stored preference to `<html>` (`dark` class). */
export function applyThemePreference(pref) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolveDark(pref));
}

export function setThemePreference(pref) {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
  applyThemePreference(pref);
}

export function initTheme() {
  applyThemePreference(getStoredThemePreference());

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getStoredThemePreference() === 'system') {
      applyThemePreference('system');
    }
  });
}
