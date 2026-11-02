/* =====================================================================
   PAGES
   ===================================================================== */
import { ago, esc, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t, lv } from '../core/i18n.js';
import { PR, ST } from '../core/constants.js';
import { D, S, commentsOf, isOver, mem, pColor, proj, task } from '../core/store.js';
import { av, dueHtml, empty, lbl, prIcon, prPill, stIcon, stPill } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';

/* ---------- shared list renderer ---------- */
export const LCOLS = {
  status: ['row.col.status', '126px'],
  assignee: ['row.col.assignee', '150px'],
  priority: ['row.col.priority', '108px'],
  due: ['row.col.due', '104px'],
  labels: ['row.col.labels', '168px'],
  project: ['row.col.project', '160px'],
};
export function cellStatus(task) {
  return `<button class="pillbtn" data-a="pop" data-pop="status" data-id="${task.id}" aria-label="${t('row.statusAria', { name: lv('status', task.status, ST[task.status].name) })}">${stPill(task.status)}</button>`;
}
export function cellAssignee(task) {
  const m = mem(task.assignee);
  return `<button class="pillbtn ${m ? '' : 'empty'}" data-a="pop" data-pop="assignee" data-id="${task.id}" aria-label="${t('row.assignee')}">${av(task.assignee, 'sm', false)}<span class="trunc">${m ? esc(m.name) : t('row.unassigned')}</span></button>`;
}
export function cellPrio(task) {
  return `<button class="pillbtn ${task.priority === 'none' ? 'empty' : ''}" data-a="pop" data-pop="priority" data-id="${task.id}" aria-label="${t('row.priority')}">${prPill(task.priority)}</button>`;
}
export function cellDue(task) {
  return `<button class="pillbtn ${task.due ? (isOver(task) ? 'over' : '') : 'empty'}" data-a="pop" data-pop="date" data-field="due" data-id="${task.id}" aria-label="${t('row.due')}">${task.due ? `${ic('calendar', 13)}<span class="num">${relDate(task.due)}</span>` : `${ic('calendar', 13)}<span>${t('row.setDate')}</span>`}</button>`;
}
export function cellLabels(task) {
  return `<button class="pillbtn ${task.labels.length ? '' : 'empty'}" data-a="pop" data-pop="labels" data-id="${task.id}" aria-label="${t('row.labels')}" style="gap:4px;overflow:hidden">${task.labels.length ? task.labels.slice(0, 2).map(lbl).join('') + (task.labels.length > 2 ? `<span class="faint" style="font-size:11px">+${task.labels.length - 2}</span>` : '') : `${ic('tag', 13)}<span>${t('row.add')}</span>`}</button>`;
}
export function cellProject(task) {
  const p = proj(task.project);
  return `<button class="pillbtn" data-a="pop" data-pop="project" data-id="${task.id}" aria-label="${t('row.project')}"><span class="pdot" style="--c:${pColor(p)}"></span><span class="trunc">${esc(p?.name)}</span></button>`;
}
export const CELL = { status: cellStatus, assignee: cellAssignee, priority: cellPrio, due: cellDue, labels: cellLabels, project: cellProject };

export function taskRow(task, cols, tpl, opt = {}) {
  const sel = S.ui.sel.has(task.id);
  const open = S.ui.openTasks[task.id];
  const editing = S.ui.editCell && S.ui.editCell.id === task.id && S.ui.editCell.f === 'title';
  const cc = commentsOf(task.id).length;
  const sd = task.subtasks.filter(s => s.done).length;
  return `<div class="trow ${task.status === 'done' ? 'done' : ''} ${sel ? 'sel' : ''}${fxc('done', task.id)}${fxc('added', task.id)}" style="--cols:${tpl}" data-task-row="${task.id}" data-group="${opt.group || ''}" data-lkey="${opt.key || ''}" data-ctx="task" data-id="${task.id}">
    <div class="handle" draggable="${opt.drag !== false}" data-drag-row="${task.id}" aria-hidden="true">${opt.drag !== false ? ic('grip-vertical', 14) : ''}</div>
    <div class="c-check">${
      opt.complete
        ? `<input type="checkbox" class="check round" ${task.status === 'done' ? 'checked' : ''} data-a="toggleDone" data-id="${task.id}" aria-label="${t('row.markComplete', { title: esc(task.title) })}">`
        : `<input type="checkbox" class="check" ${sel ? 'checked' : ''} data-a="selRow" data-id="${task.id}" aria-label="${t('row.selectTask', { title: esc(task.title) })}">`
    }</div>
    <div class="ttl" ${editing ? '' : `data-a="openTask" data-id="${task.id}"`} data-dbl="editTitle">
      ${task.subtasks.length ? `<span class="ibtn ibtn-xs" data-a="expandRow" data-id="${task.id}" aria-label="${t(open ? 'row.hideSubtasks' : 'row.showSubtasks')}" aria-expanded="${!!open}" style="margin-inline-start:-4px">${ic(open ? 'chevron-down' : 'chevron-right', 13)}</span>` : '<span style="width:18px;flex-shrink:0"></span>'}
      <span class="key">${task.key}</span>
      ${editing ? `<input class="inline-in" id="edit-title" data-in="noop" data-blur="commitTitle" data-key-enter="commitTitle" data-id="${task.id}" value="${esc(task.title)}" aria-label="${t('row.taskTitle')}">` : `<span class="tt">${esc(task.title)}</span>`}
      ${task.recur ? `<span class="meta-mini" data-tip="${t('row.repeats', { freq: task.recur.toLowerCase() })}">${ic('repeat', 11)}</span>` : ''}
      ${task.subtasks.length ? `<span class="meta-mini">${ic('list-checks', 11)}${sd}/${task.subtasks.length}</span>` : ''}
      ${cc ? `<span class="meta-mini">${ic('message-square', 11)}${cc}</span>` : ''}
    </div>
    ${cols.map(c => `<div class="c-meta c-${c === 'labels' ? 'lbl' : c}">${CELL[c](task)}</div>`).join('')}
    <div class="c-more"><button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="task" data-id="${task.id}" aria-label="${t('row.moreActions')}">${ic('ellipsis', 15)}</button></div>
  </div>
  ${open ? `<div class="subrows">${task.subtasks.map(s => `<div class="subrow ${s.done ? 'done' : ''}"><input type="checkbox" class="check" ${s.done ? 'checked' : ''} data-a="toggleSub" data-id="${task.id}" data-sid="${s.id}" aria-label="${t('row.completeSubtask')}"><span>${esc(s.title)}</span></div>`).join('')}</div>` : ''}`;
}
export function listHtml(groups, key, opt = {}) {
  const cols = opt.cols || ['status', 'assignee', 'priority', 'due', 'labels'];
  const tpl = `18px 30px minmax(220px,1fr) ${cols.map(c => LCOLS[c][1]).join(' ')} 40px`;
  const all = groups.flatMap(g => g.tasks.map(task => task.id));
  const nSel = all.filter(id => S.ui.sel.has(id)).length;
  const total = all.length;
  if (!total && !opt.keepEmpty)
    return (
      opt.emptyHtml ||
      empty(
        'list-checks',
        t('row.empty'),
        t('row.emptyDesc'),
        `<button class="btn btn-primary btn-sm" data-a="newTask" ${opt.project ? `data-project="${opt.project}"` : ''}>${ic('plus', 14)}${t('row.newTask')}</button>`,
      )
    );
  const v = S.views[key];
  return `<div class="tlist" role="table" aria-label="${t('row.aria')}">
    <div class="thead" style="--cols:${tpl}" role="row">
      <div></div>
      <div>${opt.complete ? '' : `<input type="checkbox" class="check" data-a="selAll" data-key="${key}" ${nSel && nSel === total ? 'checked' : ''} ${nSel && nSel < total ? 'data-indet="1"' : ''} aria-label="${t('row.selectAll')}">`}</div>
      <div data-a="sortBy" data-key="${key}" data-f="title" style="cursor:pointer">${t('row.task')} ${v?.sort.f === 'title' ? ic(v.sort.dir > 0 ? 'arrow-up' : 'arrow-down', 11) : ''}</div>
      ${cols.map(c => `<div data-a="sortBy" data-key="${key}" data-f="${c === 'labels' ? 'manual' : c}" style="cursor:pointer">${t(LCOLS[c][0])} ${v?.sort.f === c ? ic(v.sort.dir > 0 ? 'arrow-up' : 'arrow-down', 11) : ''}</div>`).join('')}
      <div></div>
    </div>
    ${groups
      .map(g => {
        const gk = key + ':' + g.key;
        const coll = S.ui.collapsedGroups[gk] ?? (g.collapsed || false);
        const comp = S.ui.composer && S.ui.composer.ctx === key && S.ui.composer.group === g.key;
        return `${
          groups.length > 1 || g.key !== 'all'
            ? `<div class="grp" data-grp-drop="${g.key}" data-key="${key}">
          <button class="ibtn ibtn-xs" data-a="toggleGroup" data-gk="${gk}" aria-expanded="${!coll}" aria-label="${t('row.toggleGroup')}">${ic(coll ? 'chevron-right' : 'chevron-down', 13)}</button>
          ${g.html || ''}<span>${esc(g.name)}</span><span class="cnt">${g.tasks.length}</span>
          ${opt.noAdd ? '' : `<button class="ibtn ibtn-xs" data-a="startComposer" data-ctx="${key}" data-group="${g.key}" data-gb="${esc(JSON.stringify(g.set || {}))}" aria-label="${t('row.addTaskTo', { name: esc(g.name) })}">${ic('plus', 13)}</button>`}
        </div>`
            : ''
        }
        ${coll ? '' : g.tasks.map(task => taskRow(task, cols, tpl, { group: g.key, drag: opt.drag, complete: opt.complete, key })).join('')}
        ${coll || opt.noAdd ? '' : comp ? `<div class="addrow" style="background:var(--surface-2)">${ic('plus', 14)}<input class="inline-in" id="composer-in" data-key-enter="commitComposer" placeholder="${t('row.composerPh')}" aria-label="${t('row.newTaskName')}"></div>` : `<button class="addrow" data-a="startComposer" data-ctx="${key}" data-group="${g.key}" data-gb="${esc(JSON.stringify(g.set || {}))}">${ic('plus', 14)}${t('row.addTask')}</button>`}`;
      })
      .join('')}
  </div>${bulkBar(all)}`;
}
export function bulkBar(ids) {
  const n = ids.filter(id => S.ui.sel.has(id)).length;
  if (!n) return '';
  return `<div class="bulkbar${S.ui.fx.bulk ? ' enter' : ''}" role="toolbar" aria-label="${t('row.bulkAria')}"><b style="font-weight:600">${t('row.selected', { n })}</b><span class="sep"></span>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-status">${ic('circle-dot', 14)}${t('row.status')}</button>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-assignee">${ic('user', 14)}${t('row.assignee')}</button>
    <button class="btn btn-sm" data-a="pop" data-pop="bulk-priority">${ic('signal-high', 14)}${t('row.priority')}</button>
    <button class="btn btn-sm" data-a="bulkDelete">${ic('trash-2', 14)}${t('row.delete')}</button><span class="sep"></span>
    <button class="btn btn-sm" data-a="clearSel" aria-label="${t('row.clearSel')}">${ic('x', 14)}</button></div>`;
}

/* ---------- activity rendering ---------- */
export function actHtml(a, opt = {}) {
  const m = mem(a.by);
  const taskObj = a.task ? task(a.task) : null;
  const p = a.project ? proj(a.project) : null;
  const obj = taskObj
    ? `<span class="obj" data-a="openTask" data-id="${taskObj.id}">${esc(taskObj.title)}</span>`
    : p
      ? `<span class="obj" data-a="go" data-r="project" data-id="${p.id}">${esc(p.name)}</span>`
      : '';
  const VERBS = {
    moved: 'act.verb.moved',
    completed: 'act.verb.completed',
    'commented on': 'act.verb.commented',
    created: 'act.verb.created',
    assigned: 'act.verb.assigned',
    'changed priority of': 'act.verb.changedPriority',
    renamed: 'act.verb.renamed',
    'added a file to': 'act.verb.addedFile',
    archived: 'act.verb.archived',
    'created project': 'act.verb.createdProject',
    'updated labels on': 'act.verb.updatedLabels',
    'set repeat on': 'act.verb.setRepeat',
    estimated: 'act.verb.estimated',
    'updated dependencies of': 'act.verb.updatedDeps',
    'changed due date of': 'act.verb.changedDue',
    'changed start date of': 'act.verb.changedStart',
    'removed a file from': 'act.verb.removedFile',
    'completed subtask on': 'act.verb.completedSubtask',
    'reopened subtask on': 'act.verb.reopenedSubtask',
    'added subtask to': 'act.verb.addedSubtask',
    'assigned a subtask on': 'act.verb.assignedSubtask',
    'set a subtask due date on': 'act.verb.setSubtaskDue',
    'changed status of project': 'act.verb.changedPStatus',
    'converted a subtask of': 'act.verb.convertedSubtask',
    restored: 'act.verb.restored',
  };
  return `<div class="fitem">${av(a.by, 'sm')}<div class="grow"><b>${esc(m?.id === D().me ? t('row.you') : m?.name || t('row.someone'))}</b> <span class="muted">${t(VERBS[a.verb] || 'act.verb.generic')}</span> ${obj} ${a.extra ? `<span class="muted">${esc(a.extra)}</span>` : ''}${opt.proj && p && taskObj ? ` <span class="faint">${t('row.inProject', { name: esc(p.name) })}</span>` : ''}</div><time>${ago(a.at)}</time></div>`;
}
export function miniRow(task, opt = {}) {
  const p = proj(task.project);
  return `<div class="mini ${task.status === 'done' ? 'done' : ''}${fxc('done', task.id)}${fxc('added', task.id)}" data-a="openTask" data-id="${task.id}" data-ctx="task" role="button" tabindex="0">
    <input type="checkbox" class="check round" ${task.status === 'done' ? 'checked' : ''} data-a="toggleDone" data-id="${task.id}" aria-label="${t('row.completeAria', { title: esc(task.title) })}">
    <span data-tip="${lv('status', task.status, ST[task.status].name)}">${stIcon(task.status)}</span>
    <span class="tt">${esc(task.title)}</span>
    ${opt.noProj ? '' : `<span class="pj hide-m"><span class="pdot" style="--c:${pColor(p)}"></span><span class="trunc">${esc(p.name)}</span></span>`}
    <span data-tip="${t('row.priorityTip', { name: lv('prio', task.priority, PR[task.priority].name) })}">${prIcon(task.priority)}</span>
    <span style="width:74px;text-align:end" class="hide-m">${dueHtml(task, false)}</span>
    ${opt.av === false ? '' : av(task.assignee, 'sm')}
  </div>`;
}
