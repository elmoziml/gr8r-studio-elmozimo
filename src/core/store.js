/* ---------- store ---------- */
import { TODAY, diffD, iso, parse, setIdGenerator, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { seed } from '../data/seed.js';
import { api, repository } from '../api/index.js';
import { backend } from '../api/backend.js';

export const STORE_KEY = 'gr8r.api.v1';
export const DEFAULT_PREFS = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'en',
  tz: '(GMT-07:00) Pacific Time',
  motion: 'system',
  home: 'home',
  openTasks: 'drawer',
  name: 'Tanjim Islam',
  title: 'Head of Product',
};
export const saved = repository.loadSync();
export const S = {
  mode: 'demo',
  revision: 0,
  data: saved?.data || seed(),
  prefs: Object.assign({}, DEFAULT_PREFS, saved?.prefs || {}),
  views: saved?.views || {},
  ui: {
    fx: {},
    auth: null,
    authStep: 'login',
    onb: 0,
    onbData: { use: 'product', team: 'kanban', size: '2-10', ws: '', proj: 'Website Launch', tmpl: 'web', invites: '' },
    route: 'home',
    params: {},
    history: [],
    collapsed: !!saved?.collapsed,
    mnav: false,
    expanded: { p1: true },
    drawer: null,
    drawerFull: false,
    drawerTab: 'comments',
    modals: [],
    pop: null,
    palette: null,
    loading: false,
    offline: false,
    sel: new Set(),
    composer: null,
    editCell: null,
    openTasks: {},
    collapsedGroups: {},
    calDate: iso(TODAY),
    calMode: 'month',
    tlZoom: 'week',
    tlGroup: 'status',
    fileView: 'grid',
    projView: 'grid',
    homeTab: 'upcoming',
    inboxCat: 'all',
    inboxUnread: false,
    inboxSel: null,
    notifFilter: 'all',
    settings: 'appearance',
    searchQ: '',
    searchCat: 'all',
    myView: 'list',
    membersTab: 'members',
    collapsedCols: {},
    errors: {},
    drafts: {},
  },
};
/* Legacy prefs stored the language label ('English (US)', 'Deutsch', …);
   the locale system uses codes. Anything that isn't a known code becomes 'en'. */
if (!['en', 'ar'].includes(S.prefs.lang)) S.prefs.lang = 'en';

export function applyDocument(doc) {
  if (!doc?.data) return;
  S.data = doc.data;
  S.prefs = Object.assign({}, DEFAULT_PREFS, doc.prefs || {});
  S.views = doc.views || {};
  S.ui.collapsed = Boolean(doc.collapsed);
  S.revision = Number(doc.revision || 0);
  if (!['en', 'ar'].includes(S.prefs.lang)) S.prefs.lang = 'en';
}

export async function hydrate() {
  applyDocument(await api.bootstrap());
  setIdGenerator(null);
  S.mode = 'demo';
}

const serverId = () =>
  globalThis.crypto?.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export async function hydrateServer() {
  applyDocument(await backend.bootstrap());
  setIdGenerator(serverId);
  S.mode = 'server';
}

export function freshData() {
  return seed();
}

export let _saveT;
let serverSaving = false;
let serverSaveAgain = false;

function scheduleServerSave(delay = 220) {
  clearTimeout(_saveT);
  _saveT = setTimeout(flushServerSave, delay);
}

async function flushServerSave() {
  if (serverSaving) {
    serverSaveAgain = true;
    return;
  }
  serverSaving = true;
  try {
    const result = await backend.saveWorkspace({
      revision: S.revision,
      data: S.data,
      prefs: S.prefs,
      views: S.views,
      collapsed: S.ui.collapsed,
    });
    S.revision = Number(result.revision || S.revision + 1);
  } catch (error) {
    if (error.status === 409) {
      await hydrateServer().catch(() => {});
      window.dispatchEvent(new CustomEvent('gr8r:save-error', { detail: { kind: 'conflict' } }));
    } else {
      console.warn('Workspace save failed:', error.message);
      window.dispatchEvent(new CustomEvent('gr8r:save-error', { detail: { kind: 'error', message: error.message } }));
    }
  } finally {
    serverSaving = false;
    if (serverSaveAgain) {
      serverSaveAgain = false;
      scheduleServerSave(0);
    }
  }
}

export async function saveNow() {
  if (S.mode !== 'server') return;
  clearTimeout(_saveT);
  while (serverSaving) await new Promise(resolve => setTimeout(resolve, 40));
  await flushServerSave();
}

export function save() {
  if (S.mode === 'server') {
    scheduleServerSave();
    return;
  }
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    api.saveDocument({ data: S.data, prefs: S.prefs, views: S.views, collapsed: S.ui.collapsed }).catch(() => {
      /* the next edit retries the save; the in-memory document stays authoritative */
    });
  }, 150);
}

/* ---------- lookups ---------- */
export const D = () => S.data;
export const me = () => D().members.find(m => m.id === D().me);
export const canManageMembers = () => ['Owner', 'Admin'].includes(me()?.role);
export const mem = id => D().members.find(m => m.id === id);
export const proj = id => D().projects.find(p => p.id === id);
export const task = id => D().tasks.find(t => t.id === id);
export const pColor = p => PCOLORS[p?.color] || PCOLORS.slate;
export const visibleProjects = () =>
  D()
    .projOrder.map(proj)
    .filter(Boolean)
    .filter(p => !p.archived);
export const canSee = p => !p.private || p.members.includes(D().me);
export const tasksOf = pid => D().tasks.filter(t => t.project === pid && !t.archived);
export const allTasks = () => D().tasks.filter(t => !t.archived && canSee(proj(t.project)));
export const isOver = t => t.due && t.status !== 'done' && diffD(parse(t.due), TODAY) < 0;
export const commentsOf = tid => D().comments.filter(c => c.task === tid);
export function progressOf(pid) {
  const ts = tasksOf(pid);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}
export function taskProg(t) {
  if (t.status === 'done') return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] || 0;
}

/* ---------- activity + notification helpers ---------- */
export function logAct(verb, t, extra = '') {
  D().activity.unshift({ id: uid('a'), by: D().me, verb, task: t?.id || null, project: t?.project || null, at: Date.now(), extra });
  if (t) t.updated = Date.now();
}

/* ---------- teams (workspace data, seeded on first use) ---------- */
export const NO_TEAM = { id: '', name: 'No team', icon: 'users', c: '#8A867E', desc: '' };
export function teamsList() {
  const d = D();
  if (!d.teams) d.teams = TEAMS_SEED.map(t => ({ ...t }));
  return d.teams;
}
export function team(id) {
  return teamsList().find(t => t.id === id) || null;
}
export const TM = new Proxy({}, { get: (_, k) => team(k) || NO_TEAM });
