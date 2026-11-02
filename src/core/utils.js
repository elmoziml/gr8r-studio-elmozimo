/* =====================================================================
   QUIRE — core: utils, icons, seed data, store, render loop, events
   ===================================================================== */
// Web fonts load without blocking first paint (the link starts as media=print).
if (typeof document !== 'undefined') {
  document.querySelectorAll('link[data-font]').forEach(l => {
    l.media = 'all';
  });
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let idGenerator = null;
export function setIdGenerator(generator) {
  idGenerator = generator;
}
export const uid = (p = 'x') => (idGenerator ? idGenerator(p) : p + Math.random().toString(36).slice(2, 8));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? '⌘' : 'Ctrl';

/* ---------- dates ---------- */
export const DAY = 864e5;
export const sod = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const TODAY = sod(new Date());
export const iso = d => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const parse = s => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addD = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dOff = n => iso(addD(TODAY, n));
export const diffD = (a, b) => Math.round((sod(a) - sod(b)) / DAY);
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/* Locale state is owned by core/i18n.js (applyLocale). */
export const locale = { code: 'en', words: {} };
export function setLocale(code, words) {
  locale.code = code;
  locale.words = words;
}
const ARA = 'ar-u-nu-latn'; // Arabic with Western digits
export const wdayShort = d => (locale.code === 'ar' ? new Intl.DateTimeFormat(ARA, { weekday: 'short' }).format(d) : WD[d.getDay()]);
export const wdayMini = d => (locale.code === 'ar' ? new Intl.DateTimeFormat('ar', { weekday: 'narrow' }).format(d) : WD[d.getDay()].slice(0, 2));
export const wdayLong = d => (locale.code === 'ar' ? new Intl.DateTimeFormat(ARA, { weekday: 'long' }).format(d) : WDL[d.getDay()]);
export const monthShort = d => (locale.code === 'ar' ? new Intl.DateTimeFormat(ARA, { month: 'short' }).format(d) : MON[d.getMonth()]);
export const monthLong = d => (locale.code === 'ar' ? new Intl.DateTimeFormat(ARA, { month: 'long' }).format(d) : MONL[d.getMonth()]);
/* Set from preferences on every render (core/theme.js), so utils never depends on the store. */
export let dateFormat = 'MMM d';
export function setDateFormat(f) {
  dateFormat = f || 'MMM d';
}
export function fmtDate(s, long) {
  const d = typeof s === 'string' ? parse(s) : s;
  if (!d) return '';
  const fmt = dateFormat;
  if (locale.code === 'ar') {
    const o = { day: 'numeric' };
    if (fmt === 'd/M' || fmt === 'M/d') o.month = 'numeric';
    else if (fmt === 'yyyy-MM-dd') {
      o.year = 'numeric';
      o.month = 'numeric';
    } else o.month = 'short';
    if (long || d.getFullYear() !== TODAY.getFullYear()) o.year = 'numeric';
    return new Intl.DateTimeFormat(ARA, o).format(d);
  }
  if (fmt === 'd/M') return `${d.getDate()}/${d.getMonth() + 1}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'M/d') return `${d.getMonth() + 1}/${d.getDate()}${long ? '/' + d.getFullYear() : ''}`;
  if (fmt === 'yyyy-MM-dd') return iso(d);
  return `${MON[d.getMonth()]} ${d.getDate()}${long || d.getFullYear() !== TODAY.getFullYear() ? ', ' + d.getFullYear() : ''}`;
}
export function relDate(s) {
  if (!s) return '';
  const n = diffD(parse(s), TODAY);
  if (n === 0) return locale.words['rel.today'] || 'Today';
  if (n === 1) return locale.words['rel.tomorrow'] || 'Tomorrow';
  if (n === -1) return locale.words['rel.yesterday'] || 'Yesterday';
  if (n > 1 && n < 7) return wdayLong(parse(s));
  return fmtDate(s);
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return locale.words['rel.justNow'] || 'just now';
  if (locale.code === 'ar') {
    if (m < 60) return new Intl.RelativeTimeFormat(ARA, { numeric: 'auto' }).format(-m, 'minute');
    const h = Math.round(m / 60);
    if (h < 24) return new Intl.RelativeTimeFormat(ARA, { numeric: 'auto' }).format(-h, 'hour');
    const d = Math.round(h / 24);
    if (d < 7) return new Intl.RelativeTimeFormat(ARA, { numeric: 'auto' }).format(-d, 'day');
    return fmtDate(iso(new Date(ts)));
  }
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  if (d < 7) return d + 'd ago';
  return fmtDate(iso(new Date(ts)));
}
export const minsAgo = m => Date.now() - m * 6e4;
export function dayBucket(ts) {
  const n = diffD(new Date(ts), TODAY);
  if (n === 0) return locale.words['rel.today'] || 'Today';
  if (n === -1) return locale.words['rel.yesterday'] || 'Yesterday';
  if (n > -7) return locale.words['rel.thisWeek'] || 'This week';
  return locale.words['rel.earlier'] || 'Earlier';
}
