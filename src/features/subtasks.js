/* ---------- subtask detail view (inside the task drawer) ---------- */
import { esc, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { mem } from '../core/store.js';
import { av } from '../ui/helpers.js';

export function subtaskHtml(task, s) {
  const i = task.subtasks.indexOf(s);
  return `<div class="subview">
    <button class="pillbtn" data-a="closeSub" style="margin:-4px 0 14px -7px;font-size:12.5px;color:var(--text-2)">${ic('arrow-left', 14, 'flip-rtl')}<span class="trunc" style="max-width:420px">${esc(task.title)}</span></button>
    <div class="row" style="gap:10px;align-items:flex-start">
      <input type="checkbox" class="check round" style="margin-top:9px" ${s.done ? 'checked' : ''} data-a="toggleSub" data-id="${task.id}" data-sid="${s.id}" aria-label="${s.done ? t('sub.markNotDone') : t('sub.markDone')}">
      <textarea class="ttl-edit" id="s-title" rows="1" data-autosize data-blur="commitSubTitle" data-key-enter="blur" data-id="${task.id}" data-sid="${s.id}" aria-label="${t('sub.title')}" style="${s.done ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${esc(s.title)}</textarea>
    </div>
    <div class="faint" style="font-size:12px;margin:4px 0 0 26px">${t('sub.of', { i: i + 1, n: task.subtasks.length })} · ${s.done ? t('sub.done') : t('sub.open')}</div>
    <dl class="kv" style="margin-top:16px">
      <dt>${ic('user', 14)}${t('sub.assignee')}</dt><dd><button class="pillbtn ${s.assignee ? '' : 'empty'}" data-a="pop" data-pop="subassignee" data-id="${task.id}" data-i="${i}">${av(s.assignee, 'sm', false)}<span>${s.assignee ? esc(mem(s.assignee)?.name) : t('view.unassigned')}</span></button></dd>
      <dt>${ic('calendar', 14)}${t('sub.due')}</dt><dd><button class="pillbtn ${s.due ? '' : 'empty'}" data-a="pop" data-pop="date" data-field="subdue" data-id="${task.id}" data-i="${i}">${ic('calendar', 13)}<span class="num">${s.due ? relDate(s.due) : t('sub.setDate')}</span></button></dd>
      <dt>${ic('folder', 14)}${t('sub.parent')}</dt><dd><button class="pillbtn" data-a="closeSub"><span class="mono faint" style="font-size:11px">${task.key}</span>${esc(task.title)}</button></dd>
    </dl>
    <div class="dsec"><div class="dsec-h"><h3 id="s-note-l">${t('sub.notes')}</h3></div>
      <textarea class="textarea" id="s-note" data-in="subNote" data-id="${task.id}" data-sid="${s.id}" rows="4" placeholder="${t('sub.notesPh')}" aria-labelledby="s-note-l">${esc(s.note || '')}</textarea></div>
    <div class="dsec row" style="gap:6px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" data-a="promoteSub" data-id="${task.id}" data-sid="${s.id}">${ic('arrow-up-right', 13, 'flip-rtl')}${t('sub.convert')}</button>
      <span class="sp"></span>
      <button class="btn btn-sm btn-ghost" data-a="subNav" data-id="${task.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="${t('sub.previousSub')}">${ic('chevron-left', 14, 'flip-rtl')}${t('sub.previous')}</button>
      <button class="btn btn-sm btn-ghost" data-a="subNav" data-id="${task.id}" data-d="1" ${i === task.subtasks.length - 1 ? 'disabled' : ''} aria-label="${t('sub.nextSub')}">${t('sub.next')}${ic('chevron-right', 14, 'flip-rtl')}</button>
      <button class="btn btn-sm btn-danger-ghost" data-a="rmSub" data-id="${task.id}" data-sid="${s.id}">${ic('trash-2', 13)}${t('sub.delete')}</button>
    </div>
  </div>`;
}
