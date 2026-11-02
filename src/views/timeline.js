/* ---------- TIMELINE ---------- */
import { $, TODAY, addD, diffD, esc, fmtDate, monthLong, monthShort, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { S, allTasks, canSee, pColor, proj, task, taskProg, visibleProjects } from '../core/store.js';
import { av, empty, stIcon } from '../ui/helpers.js';
import { applyView, groupTasks, viewOf, viewToolbar } from '../shell/view-engine.js';
import { startOfWeek } from './calendar.js';

export function tlControls() {
  return `<div class="seg" style="margin-inline-start:4px">${[
    ['week', 'tl.weeks'],
    ['month', 'tl.months'],
  ]
    .map(([k, n]) => `<button class="${S.ui.tlZoom === k ? 'on' : ''}" data-a="set" data-k="tlZoom" data-v="${k}">${t(n)}</button>`)
    .join('')}</div>
  <select class="select" style="height:26px;width:auto;font-size:12px;margin-inline-start:4px" data-in="tlGroup" aria-label="${t('tl.groupBy')}">${[
    ['status', 'tl.groupStatus'],
    ['assignee', 'tl.groupAssignee'],
    ['project', 'tl.groupProject'],
    ['none', 'tl.noGrouping'],
  ]
    .map(([k, n]) => `<option value="${k}" ${S.ui.tlGroup === k ? 'selected' : ''}>${t(n)}</option>`)
    .join('')}</select>
  <button class="btn btn-ghost" data-a="tlToday">${ic('crosshair', 14)}${t('tl.today')}</button>`;
}
export function timelineHtml(ts, key, p) {
  const dw = S.ui.tlZoom === 'week' ? 32 : 11;
  const rs = startOfWeek(addD(TODAY, S.ui.tlZoom === 'week' ? -21 : -56));
  const nDays = S.ui.tlZoom === 'week' ? 7 * 13 : 7 * 34;
  const X = ds => diffD(parse(ds), rs) * dw;
  const g = S.ui.tlGroup;
  const groups = groupTasks(
    ts.filter(tk => tk.due),
    g === 'project' && p ? 'status' : g,
  ).filter(G => G.tasks.length);
  const rows = [];
  const ms = p
    ? p.milestones || []
    : visibleProjects()
        .filter(canSee)
        .flatMap(q => (q.milestones || []).map(m => ({ ...m, p: q })));
  if (ms.length) rows.push({ type: 'ms' });
  groups.forEach(G => {
    if (g !== 'none') rows.push({ type: 'g', G });
    G.tasks.sort((a, b) => ((a.start || a.due) > (b.start || b.due) ? 1 : -1)).forEach(tk => rows.push({ type: 't', t: tk }));
  });
  const RH = 36;
  const H = rows.length * RH;
  const W = nDays * dw;
  const rowY = {};
  rows.forEach((r, i) => {
    if (r.type === 't') rowY[r.t.id] = i * RH + RH / 2;
  });
  // header
  let months = [],
    cm = null;
  for (let i = 0; i < nDays; i++) {
    const d = addD(rs, i);
    const k = d.getMonth() + '-' + d.getFullYear();
    if (k !== cm) {
      months.push({ d, i, n: 0 });
      cm = k;
    }
    months[months.length - 1].n++;
  }
  const days =
    S.ui.tlZoom === 'week'
      ? Array.from({ length: nDays }, (_, i) => {
          const d = addD(rs, i);
          return `<div style="width:${dw}px" class="${diffD(d, TODAY) === 0 ? 'today' : ''}">${d.getDate()}</div>`;
        }).join('')
      : Array.from({ length: nDays / 7 }, (_, i) => {
          const d = addD(rs, i * 7);
          return `<div style="width:${dw * 7}px">${monthShort(d)} ${d.getDate()}</div>`;
        }).join('');
  const weekend =
    S.ui.tlZoom === 'week'
      ? Array.from({ length: nDays }, (_, i) => {
          const d = addD(rs, i);
          return d.getDay() === 0 || d.getDay() === 6 ? `<div class="tl-we" style="inset-inline-start:${i * dw}px;width:${dw}px"></div>` : '';
        }).join('')
      : '';
  const glines = Array.from({ length: nDays / 7 }, (_, i) => `<div class="tl-gl" style="inset-inline-start:${i * 7 * dw}px"></div>`).join('');
  const bars = rows
    .map((r, i) => {
      const y = i * RH;
      if (r.type === 'g') return `<div class="tl-rowbg g" style="top:${y}px"></div>`;
      if (r.type === 'ms') return `<div class="tl-rowbg" style="top:${y}px"></div>` + msLane(ms, X, dw, y);
      const tk = r.t;
      const pp = proj(tk.project);
      const s = tk.start && tk.start <= tk.due ? tk.start : tk.due;
      const x = X(s);
      const w = Math.max(dw, (diffD(parse(tk.due), parse(s)) + 1) * dw);
      const c = g === 'status' || g === 'none' ? pColor(pp) : `var(--st-${tk.status})`;
      const inside = w > 110;
      return `<div class="tl-rowbg" style="top:${y}px"></div><div class="bar ${tk.status === 'done' ? 'done' : ''}" style="--c:${c};inset-inline-start:${x}px;top:${y + 7}px;width:${w}px" data-bar="${tk.id}" data-dw="${dw}" data-a="openTask" data-id="${tk.id}" data-ctx="task" title="${esc(tk.title)} · ${fmtDate(s)} → ${fmtDate(tk.due)}"><span class="pf" style="width:${taskProg(tk)}%"></span>${inside ? `${av(tk.assignee, 'sm', false)}<span class="trunc">${esc(tk.title)}</span>` : ''}</div>${inside ? '' : `<div class="bar-lbl" style="inset-inline-start:${x + w + 8}px;top:${y + 10}px">${esc(tk.title)}</div>`}`;
    })
    .join('');
  // dependency paths
  const deps = ts
    .flatMap(tk =>
      tk.deps
        .filter(d => rowY[d] != null && rowY[tk.id] != null)
        .map(d => {
          const a = task(d);
          const x1 = X(a.due) + dw;
          const y1 = rowY[d];
          const s = tk.start && tk.start <= tk.due ? tk.start : tk.due;
          const x2 = X(s);
          const y2 = rowY[tk.id];
          const mx = Math.max(x1 + 10, x2 - 10);
          return `<path d="M${x1} ${y1} C ${mx} ${y1}, ${Math.min(x1 + 10, x2 - 10)} ${y2}, ${x2 - 1} ${y2}" fill="none" stroke="var(--text-3)" stroke-width="1.3" stroke-dasharray="${x2 < x1 ? '3 3' : ''}"/><path d="M${x2 - 6} ${y2 - 3.5} L${x2 - 1} ${y2} L${x2 - 6} ${y2 + 3.5}" fill="none" stroke="var(--text-3)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
        }),
    )
    .join('');
  const left = rows
    .map(r => {
      if (r.type === 'ms')
        return `<div class="tl-row g">${ic('diamond', 12)}${t('tl.milestones')}<span class="faint" style="font-weight:500">${ms.length}</span></div>`;
      if (r.type === 'g')
        return `<div class="tl-row g">${r.G.html || ''}${esc(r.G.name)}<span class="faint" style="font-weight:500">${r.G.tasks.length}</span></div>`;
      const tk = r.t;
      return `<div class="tl-row" data-a="openTask" data-id="${tk.id}">${stIcon(tk.status, 13)}<span class="trunc grow" style="${tk.status === 'done' ? 'color:var(--text-3)' : ''}">${esc(tk.title)}</span>${tk.subtasks.length ? `<span class="faint num" style="font-size:11px">${tk.subtasks.filter(s => s.done).length}/${tk.subtasks.length}</span>` : ''}${av(tk.assignee, 'sm')}</div>`;
    })
    .join('');
  if (!rows.length)
    return empty(
      'chart-gantt',
      t('tl.empty'),
      t('tl.emptyDesc'),
      `<button class="btn btn-primary btn-sm" data-a="newTask" ${p ? `data-project="${p.id}"` : ''}>${ic('plus', 14)}${t('tl.newTask')}</button>`,
    );
  const todayX = diffD(TODAY, rs) * dw;
  return `<div class="tl" data-tl-today="${todayX}" data-tl-key="${key}">
    <div class="tl-left"><div class="tl-head">${t('tl.task')}</div><div class="tl-rows" id="tl-rows">${left}<div style="height:40px"></div></div></div>
    <div class="tl-right" id="tl-right" data-keep="tl:${key}:${S.ui.tlZoom}">
      <div class="tl-head" style="width:${W}px"><div class="tl-months">${months.map(m => `<div style="width:${m.n * dw}px"><span>${monthLong(m.d)} ${m.d.getFullYear()}</span></div>`).join('')}</div><div class="tl-days">${days}</div></div>
      <div class="tl-grid" style="width:${W}px;height:${H + 40}px">
        ${weekend}${glines}
        <div class="tl-today" style="inset-inline-start:${todayX + dw / 2}px" title="${t('tl.today')}"></div>
        ${bars}
        <svg class="tl-deps" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${deps}</svg>
      </div>
    </div>
  </div>`;
}
/* Milestone lane: one diamond per date (same-day milestones merge), and each label may only use
   the room up to the next diamond. Long names are cut with an ellipsis, cramped ones show just the
   diamond; the full name and date are always in the hover tooltip. Labels never overlap. */
export function msLane(ms, X, dw, y) {
  const byDate = {};
  ms.forEach(m => (byDate[m.date] ||= []).push(m));
  const pts = Object.entries(byDate)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, list]) => ({ date, list, x: X(date) + dw / 2 }));
  return pts
    .map((pt, i) => {
      const room = (pts[i + 1] ? pts[i + 1].x : Infinity) - pt.x - 24;
      const first = pt.list[0];
      const name = first.name + (pt.list.length > 1 ? ` +${pt.list.length - 1}` : '');
      const tip = pt.list.map(m => m.name + (m.p ? ` (${m.p.name})` : '')).join(' · ') + ' · ' + fmtDate(pt.date);
      const label = room >= 28 ? `<span class="ms-l" style="max-width:${Number.isFinite(room) ? Math.round(room) + 'px' : 'none'}">${esc(name)}</span>` : '';
      return `<div class="ms-w" style="inset-inline-start:${pt.x - 6}px;top:${y + 9}px" data-tip="${esc(tip)}" tabindex="0" aria-label="${t('tl.milestoneAria', { tip: esc(tip) })}"><span class="ms" style="${first.p ? `background:${pColor(first.p)}` : ''}"></span>${label}</div>`;
    })
    .join('');
}
export function tlAfter() {
  const r = $('#tl-right'),
    l = $('#tl-rows');
  if (!r || !l) return;
  r.onscroll = () => {
    l.scrollTop = r.scrollTop;
  };
  l.scrollTop = r.scrollTop;
  const k = $('.tl').dataset.tlKey + S.ui.tlZoom;
  S.ui.tlInit = S.ui.tlInit || {};
  if (!S.ui.tlInit[k]) {
    S.ui.tlInit[k] = 1;
    r.scrollLeft = Math.max(0, +$('.tl').dataset.tlToday - 160);
  }
}
export function pageWsTimeline() {
  const key = 'tl';
  const v = viewOf(key);
  if (!S.ui._tlWsInit) {
    S.ui._tlWsInit = 1;
    S.ui.tlGroup = 'project';
  }
  return `<div class="page flush"><div class="ph"><div><h1>${t('tl.title')}</h1><p>${t('tl.sub')}</p></div></div>
  ${viewToolbar(key, { group: false, extra: tlControls(key) })}${timelineHtml(applyView(allTasks(), v), key, null)}</div>`;
}
