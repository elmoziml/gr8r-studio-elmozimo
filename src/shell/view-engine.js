/* ---------- filter engine ---------- */
import { DAY, TODAY, diffD, esc, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t, lv } from '../core/i18n.js';
import { LABELS, PR, PRIOS, STATUSES } from '../core/constants.js';
import { D, S, canSee, isOver, mem, pColor, proj, visibleProjects } from '../core/store.js';
import { av, prIcon, stIcon } from '../ui/helpers.js';

export const FIELDS = {
  status: {
    name: () => t('view.field.status'),
    icon: 'circle-dot',
    opts: () => STATUSES.map(s => ({ id: s.id, name: lv('status', s.id, s.name), html: stIcon(s.id) })),
  },
  assignee: {
    name: () => t('view.field.assignee'),
    icon: 'user',
    opts: () => [
      { id: 'none', name: t('view.unassigned'), html: av(null, 'sm', false) },
      ...D().members.map(m => ({ id: m.id, name: m.name + (m.id === D().me ? t('view.you') : ''), html: av(m.id, 'sm', false) })),
    ],
  },
  priority: {
    name: () => t('view.field.priority'),
    icon: 'signal-high',
    opts: () => PRIOS.map(p => ({ id: p.id, name: lv('prio', p.id, p.name), html: prIcon(p.id) })),
  },
  due: {
    name: () => t('view.field.due'),
    icon: 'calendar',
    opts: () => [
      { id: 'overdue', name: t('view.overdue') },
      { id: 'today', name: t('view.today') },
      { id: 'week', name: t('view.week') },
      { id: 'later', name: t('view.later') },
      { id: 'nodate', name: t('view.nodate') },
    ],
  },
  project: {
    name: () => t('view.field.project'),
    icon: 'folder',
    opts: () =>
      visibleProjects()
        .filter(canSee)
        .map(p => ({ id: p.id, name: p.name, html: `<span class="pdot" style="--c:${pColor(p)}"></span>` })),
  },
  labels: {
    name: () => t('view.field.labels'),
    icon: 'tag',
    opts: () => LABELS.map(l => ({ id: l.id, name: l.name, html: `<span class="pdot" style="--c:${l.c}"></span>` })),
  },
  created: {
    name: () => t('view.field.created'),
    icon: 'calendar-plus',
    opts: () => [
      { id: '1', name: t('view.last24') },
      { id: '7', name: t('view.last7') },
      { id: '30', name: t('view.last30') },
    ],
  },
  updated: {
    name: () => t('view.field.updated'),
    icon: 'history',
    opts: () => [
      { id: '1', name: t('view.last24') },
      { id: '7', name: t('view.last7') },
      { id: '30', name: t('view.last30') },
    ],
  },
};
export function viewOf(key) {
  if (!S.views[key])
    S.views[key] = {
      filters: [],
      sort: { f: 'manual', dir: 1 },
      group: key === 'tasks' || key === 'mytasks' ? 'status' : 'status',
      q: '',
      hidden: ['start', 'created', 'deps'],
      colW: {},
      showDone: true,
    };
  return S.views[key];
}
export function matchF(t, f) {
  if (!f.v || !f.v.length) return true;
  let hit;
  if (f.f === 'labels') hit = f.v.some(v => t.labels.includes(v));
  else if (f.f === 'assignee') hit = f.v.includes(t.assignee || 'none');
  else if (f.f === 'due') {
    hit = f.v.some(v => {
      if (v === 'nodate') return !t.due;
      if (!t.due) return false;
      const n = diffD(parse(t.due), TODAY);
      return v === 'overdue' ? isOver(t) : v === 'today' ? n === 0 : v === 'week' ? n >= 0 && n <= 7 : n > 7;
    });
  } else if (f.f === 'created' || f.f === 'updated') {
    const ts = f.f === 'created' ? t.created : t.updated;
    hit = f.v.some(v => Date.now() - ts <= +v * DAY);
  } else hit = f.v.includes(t[f.f]);
  return f.op === 'not' ? !hit : hit;
}
export function applyView(ts, v) {
  let out = ts.filter(t => v.filters.every(f => matchF(t, f)));
  if (v.q) {
    const q = v.q.toLowerCase();
    out = out.filter(t => t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q));
  }
  return sortTasks(out, v.sort);
}
export function sortTasks(ts, s) {
  const d = s.dir || 1;
  const a = [...ts];
  const key =
    {
      manual: t => t.order,
      title: t => t.title.toLowerCase(),
      due: t => t.due || '9999',
      start: t => t.start || '9999',
      priority: t => -PR[t.priority || 'none'].w,
      status: t => STATUSES.findIndex(x => x.id === t.status),
      assignee: t => mem(t.assignee)?.name || 'zzz',
      created: t => -t.created,
      updated: t => -t.updated,
      estimate: t => t.estimate || 'zzz',
      project: t => proj(t.project)?.name,
    }[s.f] || (t => t.order);
  return a.sort((x, y) => {
    const p = key(x),
      q = key(y);
    return (p > q ? 1 : p < q ? -1 : 0) * d;
  });
}
export function groupTasks(ts, g) {
  if (g === 'none') return [{ key: 'all', name: t('view.allTasks'), html: '', tasks: ts }];
  let groups;
  if (g === 'status') groups = STATUSES.map(s => ({ key: s.id, name: lv('status', s.id, s.name), html: stIcon(s.id), set: { status: s.id } }));
  else if (g === 'priority') groups = PRIOS.map(p => ({ key: p.id, name: lv('prio', p.id, p.name), html: prIcon(p.id), set: { priority: p.id } }));
  else if (g === 'assignee')
    groups = [
      ...D().members.map(m => ({ key: m.id, name: m.name, html: av(m.id, 'sm', false), set: { assignee: m.id } })),
      { key: 'none', name: t('view.unassigned'), html: av(null, 'sm', false), set: { assignee: null } },
    ];
  else if (g === 'project')
    groups = visibleProjects()
      .filter(canSee)
      .map(p => ({ key: p.id, name: p.name, html: `<span class="pdot" style="--c:${pColor(p)}"></span>`, set: { project: p.id } }));
  else if (g === 'due')
    groups = [
      { key: 'overdue', name: t('view.overdue') },
      { key: 'today', name: t('view.today') },
      { key: 'week', name: t('view.week') },
      { key: 'later', name: t('view.later') },
      { key: 'nodate', name: t('view.nodate') },
    ].map(x => ({ ...x, html: ic('calendar', 14) }));
  groups.forEach(G => {
    G.tasks = ts.filter(t => {
      if (g === 'assignee') return (t.assignee || 'none') === G.key;
      if (g === 'due') return matchF(t, { f: 'due', op: 'is', v: [G.key] });
      return t[g] === G.key;
    });
  });
  return g === 'status' || g === 'priority' ? groups : groups.filter(G => G.tasks.length);
}
export function filterChips(key) {
  const v = viewOf(key);
  if (!v.filters.length) return '';
  const chips = v.filters
    .map((f, i) => {
      const F = FIELDS[f.f];
      const opts = F.opts();
      const names = f.v.map(id => opts.find(o => o.id === id)?.name || id);
      const val = names.length ? (names.length > 2 ? t('view.selected', { n: names.length }) : names.join(', ')) : t('view.any');
      return `${i ? `<span>${t('view.and')}</span>` : ''}<span class="chip"><button data-a="pop" data-pop="fvals" data-key="${key}" data-i="${i}" style="display:inline-flex;gap:5px;align-items:center">${ic(F.icon, 12)}<b>${F.name()}</b> ${f.op === 'not' ? t('view.isNot') : t('view.is')} <span>${esc(val)}</span></button><button class="ibtn" data-a="rmFilter" data-key="${key}" data-i="${i}" aria-label="${t('view.filter')}">${ic('x', 12)}</button></span>`;
    })
    .join('');
  return `<div class="chipsbar">${ic('list-filter', 13)}${chips}<button class="btn btn-sm btn-ghost" data-a="pop" data-pop="filter" data-key="${key}">${ic('plus', 12)}${t('view.add')}</button><span class="sp"></span><button class="btn btn-sm btn-ghost" data-a="clearFilters" data-key="${key}">${t('view.clearAll')}</button></div>`;
}
export function viewToolbar(key, opt = {}) {
  const v = viewOf(key);
  const sortName = {
    manual: t('view.sort.manual'),
    title: t('view.sort.title'),
    due: t('view.sort.due'),
    priority: t('view.sort.priority'),
    status: t('view.sort.status'),
    created: t('view.sort.created'),
    updated: t('view.sort.updated'),
    assignee: t('view.sort.assignee'),
    start: t('view.sort.start'),
    estimate: t('view.sort.estimate'),
    project: t('view.sort.project'),
  }[v.sort.f];
  return `<div class="toolbar" role="toolbar">
    <div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="vq-${key}" data-in="viewQ" data-key="${key}" placeholder="${t('view.searchTasks')}" value="${esc(v.q)}" aria-label="${t('view.searchTasks')}"></div>
    <button class="btn btn-ghost ${v.filters.length ? 'on' : ''}" data-a="pop" data-pop="filter" data-key="${key}">${ic('list-filter', 14)}${t('view.filter')}${v.filters.length ? ` <span class="badge accent" style="height:16px;padding:0 5px">${v.filters.length}</span>` : ''}</button>
    <button class="btn btn-ghost" data-a="pop" data-pop="sort" data-key="${key}">${ic('arrow-up-down', 14)}<span class="hide-m">${t('view.sortLabel')}</span> ${sortName}</button>
    ${opt.group !== false ? `<button class="btn btn-ghost" data-a="pop" data-pop="group" data-key="${key}">${ic('rows-3', 14)}<span class="hide-m">${t('view.groupLabel')}</span> ${{ status: t('view.group.status'), priority: t('view.group.priority'), assignee: t('view.group.assignee'), project: t('view.group.project'), due: t('view.group.due'), none: t('view.group.none') }[v.group]}</button>` : ''}
    ${opt.cols ? `<button class="btn btn-ghost" data-a="pop" data-pop="cols" data-key="${key}">${ic('columns-3', 14)}${t('view.columns')}</button>` : ''}
    ${opt.extra || ''}
    <span class="sp"></span>
    ${opt.right || ''}
  </div>${filterChips(key)}`;
}
