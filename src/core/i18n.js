/* =====================================================================
   I18N: tiny dictionary-based localization (no dependencies).
   - en/ar flat dictionaries in src/locales/ (ar falls back to en).
   - t(key, vars) interpolates {{var}}.
   - applyLocale() sets <html lang/dir> from S.prefs.lang.
   - ltr() wraps Latin-only tokens (keys, emails, URLs) in <bdi dir="ltr">.
   ===================================================================== */
import { esc, setLocale } from './utils.js';
import { S } from './store.js';
import { en } from '../locales/en.js';
import { ar } from '../locales/ar.js';

const dicts = { en, ar };
export const langCode = () => (S.prefs.lang === 'ar' ? 'ar' : 'en');
export const isRTL = () => langCode() === 'ar';

export function t(key, vars) {
  const code = langCode();
  let s = dicts[code]?.[key] ?? dicts.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{{' + k + '}}').join(String(v));
  return s;
}

/* Localized vocabulary lookup with a fallback: lv('status', 'todo', 'To Do'). */
export function lv(prefix, id, fallback) {
  const code = langCode();
  return dicts[code][prefix + '.' + id] ?? dicts.en[prefix + '.' + id] ?? fallback;
}

export function applyLocale() {
  const r = document.documentElement;
  const code = langCode();
  if (r.lang !== code) r.lang = code;
  const dir = isRTL() ? 'rtl' : 'ltr';
  if (r.dir !== dir) r.dir = dir;
  /* feed the date helpers in utils.js (avoids a utils -> i18n dependency cycle) */
  setLocale(code, {
    'rel.today': t('rel.today'),
    'rel.tomorrow': t('rel.tomorrow'),
    'rel.yesterday': t('rel.yesterday'),
    'rel.justNow': t('rel.justNow'),
    'rel.thisWeek': t('rel.thisWeek'),
    'rel.earlier': t('rel.earlier'),
  });
}

/* Isolate Latin tokens inside RTL text (task keys, emails, URLs, dates). */
export const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
