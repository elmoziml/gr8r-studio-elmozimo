/* ---------------- COMMAND PALETTE ---------------- */
import { MOD, clamp, esc } from '../core/utils.js';
import { LOGO, ic, wsLogo } from '../core/icons.js';
import { t, lv } from '../core/i18n.js';
import { PSTAT } from '../core/constants.js';
import { D, S, allTasks, canManageMembers, pColor, proj, save, task } from '../core/store.js';
import { FT, av, hl, stIcon } from '../ui/helpers.js';
import { effectiveDark } from '../core/theme.js';
import { go, render } from '../shell/render.js';
import { sortTasks } from '../shell/view-engine.js';
import { searchAll } from '../pages/search.js';
import { openModal } from './modals.js';
import { A } from '../actions/actions.js';

export function commands() {
  return [
    { id: 'c-task', name: t('pal.createTask'), icon: 'plus', kbd: 'N', run: () => A.newTask(document.body) },
    { id: 'c-proj', name: t('pal.createProject'), icon: 'folder-plus', kbd: 'P', run: () => A.newProject() },
    {
      id: 'c-search',
      name: t('pal.searchWorkspace'),
      icon: 'search',
      kbd: '/',
      run: () => {
        S.ui.palette = { q: '', mode: 'search', scope: 'all', hl: 0 };
        render();
      },
    },
    { id: 'c-home', name: t('pal.goHome'), icon: 'house', kbd: 'G H', run: () => go('home') },
    { id: 'c-inbox', name: t('pal.goInbox'), icon: 'inbox', kbd: 'G I', run: () => go('inbox') },
    { id: 'c-my', name: t('pal.goMyTasks'), icon: 'circle-check', kbd: 'G T', run: () => go('mytasks') },
    { id: 'c-projs', name: t('pal.goProjects'), icon: 'folder-kanban', kbd: 'G P', run: () => go('projects') },
    { id: 'c-cal', name: t('pal.goCalendar'), icon: 'calendar', kbd: 'G C', run: () => go('calendar') },
    { id: 'c-tl', name: t('pal.goTimeline'), icon: 'chart-gantt', run: () => go('timeline') },
    { id: 'c-mem', name: t('pal.goMembers'), icon: 'users', run: () => go('members') },
    { id: 'c-set', name: t('pal.openSettings'), icon: 'settings', kbd: 'G S', run: () => go('settings') },
    { id: 'c-app', name: t('pal.appearanceSettings'), icon: 'palette', run: () => go('settings', { sec: 'appearance' }) },
    {
      id: 'c-ws',
      name: t('pal.switchWorkspace'),
      icon: 'arrow-left-right',
      run: () => {
        S.ui.palette = { q: '', mode: 'ws', hl: 0 };
        render();
      },
    },
    {
      id: 'c-dark',
      name: effectiveDark() ? t('pal.switchToLight') : t('pal.switchToDark'),
      icon: effectiveDark() ? 'sun' : 'moon',
      kbd: MOD + ' ⇧ L',
      run: () => A.toggleDark(),
    },
    ...(canManageMembers() ? [{ id: 'c-inv', name: t('pal.inviteMember'), icon: 'user-plus', run: () => A.addMember() }] : []),
    { id: 'c-side', name: t('pal.toggleSidebar'), icon: 'panel-left', kbd: '[', run: () => A.toggleSide() },
    { id: 'c-keys', name: t('pal.keyboardShortcuts'), icon: 'keyboard', kbd: '?', run: () => A.shortcuts() },
    { id: 'c-out', name: t('pal.signOut'), icon: 'log-out', run: () => A.signOut() },
  ];
}
export function paletteItems() {
  const pl = S.ui.palette;
  const q = pl.q.trim();
  const ql = q.toLowerCase();
  const groups = [];
  if (pl.mode === 'ws') {
    groups.push({
      name: t('pal.switchWs'),
      items: D()
        .workspaces.filter(w => !q || w.name.toLowerCase().includes(ql))
        .map(w => ({ html: `${wsLogo(w, 20)}`, name: w.name, sub: t('pal.planLabel', { plan: w.plan }), run: () => A.switchWs({ dataset: { v: w.id } }) })),
    });
    return groups;
  }
  if (pl.mode === 'cmd') {
    const cmds = commands().filter(c => !q || c.name.toLowerCase().includes(ql));
    if (!q) {
      groups.push({ name: t('pal.suggestions'), items: cmds.slice(0, 3).concat(cmds.filter(c => c.id === 'c-dark' || c.id === 'c-ws')) });
      const recent = sortTasks(
        allTasks().filter(tk => tk.assignee === D().me || tk.fav),
        { f: 'updated', dir: 1 },
      ).slice(0, 4);
      groups.push({
        name: t('pal.recentTasks'),
        items: recent.map(tk => ({
          html: stIcon(tk.status),
          name: tk.title,
          sub: proj(tk.project).name,
          r: tk.key,
          run: () => A.openTask({ dataset: { id: tk.id } }),
        })),
      });
      groups.push({ name: t('pal.navigation'), items: cmds.filter(c => ['c-home', 'c-inbox', 'c-my', 'c-projs', 'c-cal', 'c-tl', 'c-mem'].includes(c.id)) });
      return groups;
    }
    if (cmds.length) groups.push({ name: t('pal.commands'), items: cmds.slice(0, 5) });
  }
  const r = searchAll(q);
  const sc = pl.mode === 'search' ? pl.scope : 'all';
  const lim = sc === 'all' ? 4 : 12;
  if (pl.mode === 'search' && !q) {
    groups.push({
      name: t('pal.recentSearches'),
      items: D().recentSearches.map(s => ({
        icon: 'history',
        name: s,
        run: () => {
          pl.q = s;
          pl.hl = 0;
          render();
        },
      })),
    });
    groups.push({
      name: t('pal.suggested'),
      items: [
        { icon: 'clock-alert', name: t('pal.overdueTasks'), run: () => A.goTasks({ dataset: { f: 'overdue' } }) },
        { icon: 'user', name: t('pal.assignedToMe'), run: () => go('mytasks') },
        {
          icon: 'signal-high',
          name: t('pal.highPriorityIn', { project: 'Website Redesign' }),
          run: () => {
            go('project', { id: 'p1', tab: 'v:v1' });
          },
        },
        { icon: 'paperclip', name: t('pal.filesIn', { project: 'Website Redesign' }), run: () => go('project', { id: 'p1', tab: 'files' }) },
      ],
    });
    return groups;
  }
  if (!q) return groups;
  if (sc === 'all' || sc === 'tasks')
    groups.push({
      name: t('pal.tasks'),
      items: r.tasks
        .slice(0, lim)
        .map(tk => ({ html: stIcon(tk.status), name: tk.title, sub: proj(tk.project).name, r: tk.key, run: () => A.openTask({ dataset: { id: tk.id } }) })),
    });
  if (sc === 'all' || sc === 'projects')
    groups.push({
      name: t('pal.projects'),
      items: r.projects.slice(0, lim).map(p => ({
        html: `<span class="pdot" style="--c:${pColor(p)}"></span>`,
        name: p.name,
        sub: lv('pstat', p.status, PSTAT[p.status].name),
        run: () => go('project', { id: p.id }),
      })),
    });
  if (sc === 'all' || sc === 'people')
    groups.push({
      name: t('pal.people'),
      items: r.people.slice(0, lim).map(m => ({ html: av(m.id, 'sm', false), name: m.name, sub: m.title, run: () => go('member', { id: m.id }) })),
    });
  if (sc === 'all' || sc === 'files')
    groups.push({
      name: t('pal.files'),
      items: r.files.slice(0, lim).map(f => ({
        icon: FT[f.type].i,
        name: f.name,
        sub: proj(f.project).name,
        r: f.size,
        run: () => openModal({ type: 'filePreview', file: f, tid: f.task }),
      })),
    });
  if (sc === 'all' || sc === 'comments')
    groups.push({
      name: t('pal.comments'),
      items: r.comments.slice(0, lim).map(c => ({
        html: av(c.by, 'sm', false),
        name: c.text,
        sub: t('pal.on', { task: task(c.task).title }),
        run: () => A.openTask({ dataset: { id: c.task } }),
      })),
    });
  const out = groups.filter(g => g.items.length);
  out.push({
    name: '',
    items: [
      {
        icon: 'search',
        name: t('pal.viewAllResults', { q }),
        run: () => {
          S.ui.searchQ = q;
          S.ui.searchCat = sc;
          if (!D().recentSearches.includes(q)) D().recentSearches.unshift(q);
          D().recentSearches = D().recentSearches.slice(0, 5);
          save();
          go('search');
        },
      },
    ],
  });
  return out;
}
export function paletteHtml() {
  const pl = S.ui.palette;
  const groups = paletteItems();
  const flat = groups.flatMap(g => g.items);
  pl._flat = flat;
  pl.hl = clamp(pl.hl, 0, Math.max(flat.length - 1, 0));
  let idx = 0;
  const ph = pl.mode === 'search' ? t('pal.searchPh') : pl.mode === 'ws' ? t('pal.findWsPh') : t('pal.cmdPh');
  return `<div class="palette" role="dialog" aria-modal="true" aria-label="${t('pal.commandMenu')}">
    <div class="pal-in">${ic(pl.mode === 'search' ? 'search' : 'command', 17)}${pl.mode !== 'cmd' ? `<span class="badge" style="flex-shrink:0">${pl.mode === 'search' ? t('pal.searchBadge') : t('pal.wsBadge')}</span>` : ''}<input id="pal-in" data-in="palQ" value="${esc(pl.q)}" placeholder="${ph}" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant="pi-${pl.hl}"><kbd>Esc</kbd></div>
    ${
      pl.mode === 'search'
        ? `<div class="pal-scope" role="tablist">${[
            ['all', t('pal.all'), 'layers'],
            ['tasks', t('pal.tasks'), 'circle-check'],
            ['projects', t('pal.projects'), 'folder'],
            ['people', t('pal.people'), 'users'],
            ['files', t('pal.files'), 'paperclip'],
            ['comments', t('pal.comments'), 'message-square'],
          ]
            .map(([k, n, i]) => `<button role="tab" class="${pl.scope === k ? 'on' : ''}" data-a="palScope" data-v="${k}">${ic(i, 12)}${n}</button>`)
            .join('')}</div>`
        : ''
    }
    <div class="pal-list" id="pal-list" role="listbox">${
      flat.length
        ? groups
            .map(
              g =>
                `<div class="pal-group">${g.name ? `<div class="pal-sec">${g.name}</div>` : ''}${g.items
                  .map(it => {
                    const i = idx++;
                    return `<div class="pi ${i === pl.hl ? 'hl' : ''}" id="pi-${i}" role="option" aria-selected="${i === pl.hl}" data-a="palRun" data-i="${i}" data-hover-i="${i}">${it.html || ic(it.icon || 'circle', 15)}<span class="trunc">${hl(it.name, pl.q.trim())}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}<span class="r">${it.r ? `<span class="mono">${esc(it.r)}</span>` : ''}${
                      it.kbd
                        ? it.kbd
                            .split(' ')
                            .map(k => `<kbd>${k}</kbd>`)
                            .join('')
                        : ''
                    }</span></div>`;
                  })
                  .join('')}</div>`,
            )
            .join('')
        : `<div class="empty-state sm"><div class="glyph">${ic('search-x', 18)}</div><h2 class="es-h">${t('pal.noResults')}</h2><p>${t('pal.noResultsDesc')}</p></div>`
    }</div>
    <div class="pal-f"><span><kbd>↑</kbd><kbd>↓</kbd>${t('pal.navigate')}</span><span><kbd>↵</kbd>${t('pal.select')}</span>${pl.mode === 'cmd' ? `<span><kbd>Tab</kbd>${t('pal.searchMode')}</span>` : `<span><kbd>⌫</kbd>${t('pal.backToCommands')}</span>`}<span class="sp" style="flex:1"></span><span>${LOGO(12)}</span></div>
  </div>`;
}
