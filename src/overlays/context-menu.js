/* ---------------- CONTEXT MENUS ---------------- */
import { ic } from '../core/icons.js';
import { t, lv } from '../core/i18n.js';
import { ST } from '../core/constants.js';
import { D, mem, proj, task, visibleProjects } from '../core/store.js';

export function ctxMenu(p) {
  const I = (act, icon, label, extra = '', r = '') =>
    `<button class="mi ${extra}" data-a="${act}" data-id="${p.id}" data-key="${p.key || ''}">${ic(icon, 15)}${label}${r ? `<span class="r">${r}</span>` : ''}</button>`;
  const sep = '<div class="msep"></div>';
  if (p.ctx === 'task') {
    const tk = task(p.id);
    if (!tk) return '';
    return (
      I('openTask', 'panel-right-open', t('ctx.open')) +
      I('editTask', 'pencil', t('ctx.edit'), '', 'E') +
      I('toggleDone', tk.status === 'done' ? 'rotate-ccw' : 'circle-check', tk.status === 'done' ? t('ctx.reopen') : t('ctx.markComplete')) +
      sep +
      I('ctxStatus', 'circle-dot', t('ctx.status')) +
      I('ctxAssign', 'user', t('ctx.assignTo')) +
      I('ctxPrio', 'signal-high', t('ctx.priority')) +
      I('ctxMove', 'folder-input', t('ctx.moveToProject')) +
      sep +
      I('toggleFavTask', 'star', tk.fav ? t('ctx.removeFav') : t('ctx.addFav')) +
      I('copyLink', 'link', t('ctx.copyLink')) +
      I('dupTask', 'copy', t('ctx.duplicate')) +
      I('archiveTask', 'archive', t('ctx.archive')) +
      sep +
      I('delTask', 'trash-2', t('ctx.delete'), 'danger', 'Del')
    );
  }
  if (p.ctx === 'project') {
    const pr = proj(p.id);
    if (!pr) return '';
    return (
      I('openProject', 'arrow-up-right', t('ctx.open')) +
      I('toggleFavProj', 'star', pr.fav ? t('ctx.removeFav') : t('ctx.addFav')) +
      I('editProject', 'pencil', t('ctx.renameEdit')) +
      I('share', 'share-2', t('ctx.share')) +
      I('copyLink', 'link', t('ctx.copyLink')) +
      I('dupProject', 'copy', t('ctx.duplicate')) +
      sep +
      (visibleProjects().indexOf(pr) > 0 ? I('projUp', 'arrow-up', t('ctx.moveUp')) : '') +
      (visibleProjects().indexOf(pr) < visibleProjects().length - 1 ? I('projDown', 'arrow-down', t('ctx.moveDown')) : '') +
      sep +
      I('archiveProject', 'archive', pr.status === 'complete' ? t('ctx.archive') : t('ctx.archiveProject')) +
      I('delProject', 'trash-2', t('ctx.deleteProject'), 'danger')
    );
  }
  if (p.ctx === 'column') {
    return (
      `<div class="mh">${lv('status', p.id, ST[p.id].name)}</div>` +
      I('colAdd', 'plus', t('ctx.addTask')) +
      I('colCollapse', 'fold-horizontal', t('ctx.collapseColumn')) +
      (p.id !== 'done' ? I('colDoneAll', 'check-check', t('ctx.markAllDone')) : I('colArchive', 'archive', t('ctx.archiveCompleted'))) +
      I('colSortPrio', 'arrow-down-wide-narrow', t('ctx.sortByPriority'))
    );
  }
  if (p.ctx === 'member') {
    const m = mem(p.id);
    if (!m) return '';
    const canRm = m.role !== 'Owner' && m.id !== D().me;
    return (
      I('viewProfile', 'user', t('ctx.viewProfile')) +
      I('assignToMember', 'plus', t('ctx.assignTask')) +
      I('copyEmail', 'mail', t('ctx.copyEmail')) +
      (canRm
        ? I('ctxRole', 'shield', t('ctx.changeRole')) +
          (m.status === 'invited' ? I('resendInvite', 'send', t('ctx.resendInvite')) : '') +
          sep +
          I('removeMember', 'user-minus', t('ctx.removeFromWorkspace'), 'danger')
        : '')
    );
  }
  if (p.ctx === 'file') {
    return (
      I('previewFile', 'eye', t('ctx.preview')) +
      I('renameFile', 'pencil', t('ctx.rename')) +
      I('copyLink', 'link', t('ctx.copyLink')) +
      I('dupFile', 'copy', t('ctx.duplicate')) +
      sep +
      I('delFile', 'trash-2', t('ctx.delete'), 'danger')
    );
  }
  if (p.ctx === 'savedview') {
    return `<button class="mi" data-a="renameView" data-id="${p.vid}">${ic('pencil', 15)}${t('ctx.renameView')}</button><button class="mi danger" data-a="delView" data-id="${p.vid}">${ic('trash-2', 15)}${t('ctx.deleteView')}</button>`;
  }
  return '';
}
