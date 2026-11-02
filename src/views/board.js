/* ---------- BOARD ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t, lv } from '../core/i18n.js';
import { PR, STATUSES } from '../core/constants.js';
import { S, commentsOf, pColor, proj } from '../core/store.js';
import { av, dueHtml, lbl, prIcon, progBar, stIcon } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';

export function kcard(task, opt = {}) {
  const cc = commentsOf(task.id).length;
  const ac = task.attachments.length;
  const sd = task.subtasks.filter(s => s.done).length;
  const p = proj(task.project);
  return `<div class="kcard ${task.status === 'done' ? 'done' : ''}${fxc('done', task.id)}${fxc('added', task.id)}${fxc('moved', task.id)}" draggable="true" data-drag-card="${task.id}" data-a="openTask" data-id="${task.id}" data-ctx="task" role="button" tabindex="0" aria-label="${esc(task.title)}">
    ${task.labels.length ? `<div class="labels">${task.labels.map(lbl).join('')}</div>` : ''}
    <div class="top">${task.status === 'done' ? `<span class="done-ic" style="margin:2px 7px 0 0;display:inline-flex" aria-label="${lv('status', 'done', 'Done')}">${stIcon('done', 14)}</span>` : ''}<div class="title">${esc(task.title)}</div></div>
    ${task.subtasks.length ? `<div class="subp">${ic('list-checks', 12)}<span class="num">${sd}/${task.subtasks.length}</span>${progBar(Math.round((sd / task.subtasks.length) * 100), sd === task.subtasks.length ? 'green' : '')}</div>` : ''}
    <div class="meta">
      ${opt.showProj ? `<span class="m" data-tip="${esc(p.name)}"><span class="pdot" style="--c:${pColor(p)}"></span></span>` : ''}
      <span class="key">${task.key}</span>
      <button class="m" data-a="pop" data-pop="priority" data-id="${task.id}" data-tip="${lv('prio', task.priority, PR[task.priority].name)}" aria-label="${t('board.priorityAria', { name: lv('prio', task.priority, PR[task.priority].name) })}">${prIcon(task.priority, 13)}</button>
      ${task.due ? `<button class="m" data-a="pop" data-pop="date" data-field="due" data-id="${task.id}" aria-label="${t('board.due')}">${dueHtml(task)}</button>` : ''}
      ${task.recur ? `<span class="m" data-tip="${t('board.repeats', { freq: task.recur.toLowerCase() })}">${ic('repeat', 12)}</span>` : ''}
      ${cc ? `<span class="m" aria-label="${t('board.nComments', { n: cc })}">${ic('message-square', 12)}${cc}</span>` : ''}
      ${ac ? `<span class="m" aria-label="${t('board.nAttachments', { n: ac })}">${ic('paperclip', 12)}${ac}</span>` : ''}
      <button class="m" data-a="pop" data-pop="assignee" data-id="${task.id}" style="margin-inline-start:auto" aria-label="${t('board.assignee')}">${av(task.assignee, 'sm')}</button>
    </div>
    <div class="hacts"><button class="ibtn ibtn-xs" data-a="toggleDone" data-id="${task.id}" data-tip="${task.status === 'done' ? t('board.reopen') : t('board.markComplete')}" aria-label="${task.status === 'done' ? t('board.reopen') : t('board.markComplete')}">${ic(task.status === 'done' ? 'rotate-ccw' : 'check', 13)}</button><button class="ibtn ibtn-xs" data-a="editTask" data-id="${task.id}" data-tip="${t('board.quickEdit')}" aria-label="${t('board.quickEdit')}">${ic('pencil', 12)}</button><button class="ibtn ibtn-xs" data-a="ctxBtn" data-ctx="task" data-id="${task.id}" aria-label="${t('board.more')}">${ic('ellipsis', 13)}</button></div>
  </div>`;
}
export function boardHtml(ts, key, opt = {}) {
  return `<div class="board" data-keep="board:${key}">${STATUSES.map(s => {
    const col = ts.filter(task => task.status === s.id).sort((a, b) => a.order - b.order);
    const ck = key + ':' + s.id;
    if (S.ui.collapsedCols[ck])
      return `<div class="bcol collapsed" data-a="toggleCol" data-ck="${ck}" data-drop-col="${s.id}" data-key="${key}" role="button" aria-label="${t('board.expandCol', { name: lv('status', s.id, s.name) })}" title="${t('board.expand')}">${stIcon(s.id)}<span class="vname">${lv('status', s.id, s.name)}<span class="faint">${col.length}</span></span></div>`;
    const comp = S.ui.composer && S.ui.composer.ctx === key && S.ui.composer.group === s.id;
    return `<section class="bcol" data-drop-col="${s.id}" data-key="${key}" aria-label="${lv('status', s.id, s.name)}">
      <div class="bcol-h">${stIcon(s.id)}<span>${lv('status', s.id, s.name)}</span><span class="cnt">${col.length}</span>
        <span class="acts"><button class="ibtn ibtn-xs" data-a="startComposer" data-ctx="${key}" data-group="${s.id}" data-gb='${JSON.stringify({ status: s.id, ...(opt.project ? { project: opt.project } : {}) })}' data-tip="${t('board.addTask')}" aria-label="${t('board.addTaskTo', { name: lv('status', s.id, s.name) })}">${ic('plus', 14)}</button><button class="ibtn ibtn-xs" data-a="ctxBtn" data-ctx="column" data-id="${s.id}" data-key="${key}" aria-label="${t('board.columnOptions')}">${ic('ellipsis', 14)}</button></span></div>
      <div class="bcol-b" data-col-body="${s.id}">
        ${col.map(task => kcard(task, { showProj: !opt.project })).join('')}
        ${
          comp
            ? `<div class="composer"><textarea id="composer-in" data-key-enter="commitComposer" placeholder="${t('board.taskNamePh')}" rows="2" aria-label="${t('board.newTaskName')}"></textarea><div class="row"><span class="faint" style="font-size:11px">${t('board.composerHint')}</span><span class="sp"></span><button class="btn btn-sm btn-ghost" data-a="cancelComposer">${t('board.cancel')}</button><button class="btn btn-sm btn-primary" data-a="commitComposer">${t('board.add')}</button></div></div>`
            : `<button class="addcard" data-a="startComposer" data-ctx="${key}" data-group="${s.id}" data-gb='${JSON.stringify({ status: s.id, ...(opt.project ? { project: opt.project } : {}) })}'>${ic('plus', 14)}${t('board.addTask')}</button>`
        }
      </div>
    </section>`;
  }).join('')}</div>`;
}
