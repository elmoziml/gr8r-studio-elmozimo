/* ---------- 404 / DENIED / FAILED ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { mem } from '../core/store.js';

export function page404() {
  return `<div class="fullstate"><div class="box"><div class="empty-state" style="padding:0"><div class="glyph">${ic('file-question', 20)}</div></div><span class="code">ERROR 404</span><h1>${t('err.notFound')}</h1><p>${t('err.notFoundDesc')}</p><div class="row"><button class="btn btn-secondary" data-a="back">${ic('arrow-left', 14, 'flip-rtl')}${t('err.goBack')}</button><button class="btn btn-primary" data-a="go" data-r="home">${t('err.goHome')}</button></div></div></div>`;
}
export function stateDenied(p) {
  const lead = mem(p?.lead);
  return `<div class="fullstate"><div class="box"><div class="empty-state" style="padding:0"><div class="glyph">${ic('lock', 20)}</div></div><span class="code">ERROR 403</span><h1>${t('err.noAccess')}</h1><p>${p ? `<b>${esc(p.name)}</b> ${t('err.privateProj')}` : ''}${t('err.ask', { lead: lead ? esc(lead.name) : t('err.projectOwner') })}</p><div class="row"><button class="btn btn-secondary" data-a="go" data-r="projects">${t('err.backProjects')}</button><button class="btn btn-primary" data-a="requestAccess" data-id="${p?.id || ''}">${t('err.requestAccess')}</button></div></div></div>`;
}
export function stateFailed() {
  return `<div class="fullstate"><div class="box"><div class="empty-state err" style="padding:0"><div class="glyph">${ic('cloud-alert', 20)}</div></div><h1>${t('err.wentWrong')}</h1><p>${t('err.failedDesc')}</p><div class="row"><button class="btn btn-secondary" data-a="go" data-r="home">${t('err.goHome')}</button><button class="btn btn-primary" data-a="reload">${ic('refresh-cw', 14)}${t('err.tryAgain')}</button></div></div></div>`;
}
