/* ---------------- MODALS ---------------- */
import { $$, MOD, ago, esc, fmtDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { PCOLORS, PICONS } from '../core/constants.js';
import { D, S, me, mem, pColor, proj, task, teamsList } from '../core/store.js';
import { FT, av, filePrev, lbl, prPill, stPill } from '../ui/helpers.js';
import { focusKey, render } from '../shell/render.js';
import { teamModal } from '../features/teams.js';

export function openModal(m) {
  S.ui.modalOpeners = S.ui.modalOpeners || [];
  S.ui.modalOpeners[S.ui.modals.length] = S.ui.popOpener && S.ui.pop ? S.ui.popOpener : focusKey(document.activeElement);
  S.ui.modals.push(m);
  S.ui.pop = null;
  render();
  setTimeout(() => {
    const all = $$('.modal');
    const last = all[all.length - 1];
    const af = last?.querySelector('[autofocus]');
    (af || last?.querySelector('input,textarea,button'))?.focus();
  }, 30);
}
export function closeModal() {
  S.ui.modals.pop();
  S.ui.pop = null;
  render();
}
export function modalHtml(m) {
  const H = (title, sub = '') =>
    `<div class="modal-h"><div><h2 id="mt-${m.type}">${title}</h2>${sub ? `<div class="muted" style="font-size:12.5px;margin-top:2px">${sub}</div>` : ''}</div><button class="ibtn ibtn-sm" data-a="closeModal" aria-label="${t('modal.close')}">${ic('x', 16)}</button></div>`;
  const wrap = (cls, inner) => `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mt-${m.type}">${inner}</div>`;
  switch (m.type) {
    case 'task':
      return wrap('', taskModal(m, H));
    case 'project':
      return wrap('', projectModal(m, H));
    case 'share':
      return wrap('', shareModal(m, H));
    case 'addMember':
      return wrap('', addMemberModal(m, H));
    case 'confirm':
      return wrap('sm', confirmModal(m, H));
    case 'prompt':
      return wrap(
        'sm',
        `${H(m.title)}<form class="modal-b" data-submit="promptSubmit"><div class="field"><label class="label" for="prompt-in">${esc(m.label)}</label><input class="input" id="prompt-in" value="${esc(m.value || '')}" autofocus></div></form><div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">${t('modal.cancel')}</button><button class="btn btn-primary" data-a="promptSubmit">${esc(m.ok || t('modal.save'))}</button></div>`,
      );
    case 'shortcuts':
      return wrap('lg', shortcutsModal(H));
    case 'team':
      return wrap('', teamModal(m, H));
    case 'filePreview':
      return wrap('lg', filePreviewModal(m, H));
    case 'saveView':
      return wrap(
        'sm',
        `${H(t('modal.saveView'), t('modal.saveViewSub'))}<form class="modal-b" data-submit="saveViewSubmit"><div class="field"><label class="label" for="sv-name">${t('modal.viewName')}</label><input class="input" id="sv-name" placeholder="${t('modal.viewNamePh')}" autofocus></div><div class="field"><label class="label" for="sv-type">${t('modal.layout')}</label><select class="select" id="sv-type"><option value="list">${t('nav.list')}</option><option value="board">${t('nav.board')}</option><option value="table">${t('route.table')}</option></select></div>${m.nf ? `<div class="hint">${t('modal.filtersSaved', { n: m.nf, s: m.nf > 1 ? 's' : '' })}</div>` : '<div class="alert info">' + ic('info', 14) + `<span>${t('modal.noFilters')}</span></div>`}</form><div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">${t('modal.cancel')}</button><button class="btn btn-primary" data-a="saveViewSubmit">${t('modal.saveViewBtn')}</button></div>`,
      );
  }
  return '';
}
export function formChip(pop, html, label) {
  return `<button class="pillbtn bordered" data-a="pop" data-pop="${pop}" data-id="__form" ${pop === 'date' ? `data-field="${label}"` : ''} aria-label="${esc(label)}">${html}</button>`;
}
export function taskModal(m, H) {
  const f = S.ui.form;
  const p = proj(f.project);
  const err = S.ui.errors.title;
  return `${H(m.edit ? t('m.editTask') : t('m.newTask'), m.edit ? `<span class="mono">${task(m.edit)?.key}</span>` : '')}
  <form class="modal-b" data-submit="submitTask" style="gap:12px">
    <div class="field"><label class="sr" for="f-title">${t('m.taskName')}</label><input class="input input-lg ${err ? 'is-error' : ''}" id="f-title" data-in="form" data-f="title" value="${esc(f.title)}" placeholder="${t('m.taskName')}" autofocus aria-invalid="${!!err}" aria-describedby="f-title-err" style="font-size:15px;font-weight:500">${err ? `<span class="err" id="f-title-err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
    <div class="field"><label class="sr" for="f-desc">${t('m.description')}</label><textarea class="textarea" id="f-desc" data-in="form" data-f="desc" placeholder="${t('m.descPh')}" rows="3">${esc(f.desc)}</textarea></div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      ${formChip('project', `<span class="pdot" style="--c:${pColor(p)}"></span>${esc(p?.name || t('m.project'))}`, t('m.project'))}
      ${formChip('status', stPill(f.status), t('m.status'))}
      ${formChip('assignee', `${av(f.assignee, 'sm', false)}${esc(mem(f.assignee)?.name || t('m.assignee'))}`, t('m.assignee'))}
      ${formChip('priority', prPill(f.priority), t('m.priority'))}
      ${formChip('date', `${ic('calendar', 13)}${f.due ? t('m.dueWith', { date: fmtDate(f.due) }) : t('m.dueDate')}`, 'due')}
      ${formChip('date', `${ic('calendar-arrow-up', 13)}${f.start ? t('m.startsWith', { date: fmtDate(f.start) }) : t('m.startDate')}`, 'start')}
      ${formChip('labels', f.labels.length ? f.labels.map(lbl).join('') : `${ic('tag', 13)}${t('m.labels')}`, t('m.labels'))}
      ${formChip('recur', `${ic('repeat', 13)}${f.recur || t('m.repeat')}`, t('m.repeat'))}
    </div>
    <div class="field"><span class="label">${t('m.subtasks')}</span>
      ${f.subtasks.map((s, i) => `<div class="subt" style="padding:0 4px">${ic('circle', 13)}<span class="s">${esc(s.title)}</span><button type="button" class="ibtn ibtn-xs x" style="opacity:1" data-a="formRmSub" data-i="${i}" aria-label="${t('m.remove')}">${ic('x', 12)}</button></div>`).join('')}
      <div class="inwrap">${ic('plus', 14)}<input class="input" id="f-sub" data-key-enter="formAddSub" placeholder="${t('m.subtaskPh')}"></div></div>
    <div class="field"><span class="label">${t('m.attachments')}</span>
      ${f.files.length ? `<div class="col" style="gap:4px">${f.files.map((x, i) => `<div class="upl" style="padding:6px 10px"><span class="ftype" style="--c:${FT[x.type].c};width:22px;height:22px">${ic(FT[x.type].i, 12)}</span><span class="grow trunc">${esc(x.name)}</span><span class="faint" style="font-size:11.5px">${x.size}</span><button type="button" class="ibtn ibtn-xs" data-a="formRmFile" data-i="${i}" aria-label="${t('m.remove')}">${ic('x', 12)}</button></div>`).join('')}</div>` : ''}
      <label class="dropzone" style="padding:10px">${ic('paperclip', 14)}<span>${t('m.attachFiles')}</span><input type="file" multiple hidden data-in="formFiles"></label></div>
  </form>
  <div class="modal-f">${m.edit ? '' : `<label class="row" style="gap:8px;font-size:12.5px;color:var(--text-2);cursor:pointer"><input type="checkbox" class="toggle" id="f-more" data-in="formMore" ${f.more ? 'checked' : ''}>${t('m.createMore')}</label>`}<span class="sp"></span>
    <span class="faint hide-m" style="font-size:11.5px"><kbd>${MOD}</kbd> <kbd>↵</kbd></span>
    <button class="btn btn-secondary" data-a="closeModal">${t('modal.cancel')}</button><button class="btn btn-primary" data-a="submitTask" id="f-submit">${m.edit ? t('m.saveChanges') : t('m.createTask')}</button></div>`;
}
export const TEMPLATES = [
  { id: 'blank', name: 'Blank project', icon: 'file', desc: 'Start from scratch', tasks: [] },
  {
    id: 'product',
    name: 'Product Development',
    icon: 'target',
    desc: 'Discovery to launch',
    tasks: ['Define problem statement', 'User research plan', 'Write PRD', 'Design exploration', 'Build MVP', 'Beta launch'],
  },
  {
    id: 'web',
    name: 'Website',
    icon: 'globe',
    desc: 'IA, design, build, launch',
    tasks: ['Sitemap & information architecture', 'Wireframes', 'Visual design', 'Build page templates', 'Content migration', 'QA & launch'],
  },
  {
    id: 'mkt',
    name: 'Marketing Campaign',
    icon: 'megaphone',
    desc: 'Brief, assets, channels',
    tasks: ['Campaign brief', 'Audience research', 'Creative assets', 'Channel plan', 'Launch campaign', 'Performance report'],
  },
  {
    id: 'design',
    name: 'Design Project',
    icon: 'palette',
    desc: 'Discovery to handoff',
    tasks: ['Discovery workshop', 'Moodboard', 'Concept directions', 'Refinement', 'Developer handoff'],
  },
  {
    id: 'software',
    name: 'Software Development',
    icon: 'code',
    desc: 'Spec, build, ship',
    tasks: ['Technical spec', 'Set up repo & CI', 'Implement core API', 'Write tests', 'Code review', 'Deploy to staging'],
  },
  {
    id: 'personal',
    name: 'Personal Project',
    icon: 'heart',
    desc: 'Plan your own goals',
    tasks: ['Brain dump ideas', 'Pick top 3 priorities', 'Schedule focus time', 'Weekly review'],
  },
];
export function projectModal(m, H) {
  const f = S.ui.pform;
  const err = S.ui.errors.pname;
  return `${H(m.edit ? t('m.projectSettings') : t('m.newProject'), m.edit ? '' : t('m.projectSub'))}
  <form class="modal-b" data-submit="submitProject">
    <div class="row" style="gap:10px;align-items:flex-start">
      <button type="button" class="picon lg" style="--c:${PCOLORS[f.color]};cursor:default;flex-shrink:0;margin-top:22px" aria-hidden="true" tabindex="-1">${ic(f.icon, 18)}</button>
      <div class="field grow"><label class="label" for="p-name">${t('m.projectName')}</label><input class="input ${err ? 'is-error' : ''}" id="p-name" data-in="pform" data-f="name" value="${esc(f.name)}" placeholder="${t('m.projectNamePh')}" autofocus aria-invalid="${!!err}">${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
    </div>
    <div class="field"><label class="label" for="p-desc">${t('m.description')}</label><textarea class="textarea" id="p-desc" data-in="pform" data-f="desc" rows="2" placeholder="${t('m.projectDescPh')}">${esc(f.desc)}</textarea></div>
    <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:220px"><span class="label">${t('m.icon')}</span><div class="iconpick" role="radiogroup" aria-label="${t('m.icon')}">${PICONS.map(i => `<button type="button" role="radio" aria-checked="${f.icon === i}" class="${f.icon === i ? 'on' : ''}" data-a="pformSet" data-f="icon" data-v="${i}" aria-label="${i}">${ic(i, 15)}</button>`).join('')}</div></div>
      <div class="field"><span class="label">${t('m.color')}</span><div class="swatches" role="radiogroup" aria-label="${t('m.color')}" style="max-width:140px">${Object.entries(
        PCOLORS,
      )
        .map(
          ([k, v]) =>
            `<button type="button" role="radio" aria-checked="${f.color === k}" class="sw ${f.color === k ? 'on' : ''}" style="--c:${v};width:22px;height:22px" data-a="pformSet" data-f="color" data-v="${k}" aria-label="${k}">${f.color === k ? ic('check', 12) : ''}</button>`,
        )
        .join('')}</div></div>
    </div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-team">${t('m.team')}</label><select class="select" id="p-team" data-in="pform" data-f="team">${teamsList()
        .map(tm => `<option value="${tm.id}" ${f.team === tm.id ? 'selected' : ''}>${tm.name}</option>`)
        .join('')}</select></div>
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-lead">${t('m.lead')}</label><select class="select" id="p-lead" data-in="pform" data-f="lead">${D()
        .members.filter(x => x.status === 'active')
        .map(x => `<option value="${x.id}" ${f.lead === x.id ? 'selected' : ''}>${esc(x.name)}</option>`)
        .join('')}</select></div>
      <div class="field" style="flex:1;min-width:150px"><label class="label" for="p-due">${t('m.targetDate')}</label><input type="date" class="input" id="p-due" data-in="pform" data-f="due" value="${f.due || ''}"></div>
    </div>
    ${m.edit ? '' : `<div class="field"><span class="label">${t('m.template')}</span><div class="tmpls" role="radiogroup">${TEMPLATES.map(tk => `<button type="button" role="radio" aria-checked="${f.tmpl === tk.id}" class="opt ${f.tmpl === tk.id ? 'on' : ''}" data-a="pformSet" data-f="tmpl" data-v="${tk.id}" style="padding:10px">${ic(tk.icon, 16)}<b style="font-size:12.5px">${tk.name}</b><span>${tk.tasks.length ? t('m.starterTasks', { n: tk.tasks.length }) : tk.desc}</span></button>`).join('')}</div></div>`}
  </form>
  <div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">${t('modal.cancel')}</button><button class="btn btn-primary" data-a="submitProject">${m.edit ? t('m.saveChanges') : t('m.createProject')}</button></div>`;
}
export const PERMS = ['Can view', 'Can comment', 'Can edit', 'Full access'];
export function shareModal(m, H) {
  const p = proj(m.id);
  p.perms = p.perms || {};
  p.access = p.access || 'workspace';
  return `${H(t('m.shareTitle', { name: esc(p.name) }))}
  <div class="modal-b">
    <form class="row" style="gap:6px" data-submit="shareInvite"><div class="grow"><label class="sr" for="share-in">${t('m.inviteByEmail')}</label><input class="input" id="share-in" placeholder="${t('m.sharePh')}" value="${esc(S.ui.shareQ || '')}" data-in="shareQ" autofocus></div>
      <select class="select" id="share-perm" style="width:132px" aria-label="${t('m.permission')}">${PERMS.map(x => `<option ${x === 'Can edit' ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <button class="btn btn-primary" data-a="shareInvite" type="button">${t('m.invite')}</button></form>
    ${
      S.ui.shareQ
        ? `<div class="panel" style="padding:4px">${
            D()
              .members.filter(
                x => !p.members.includes(x.id) && (x.name.toLowerCase().includes(S.ui.shareQ.toLowerCase()) || x.email.includes(S.ui.shareQ.toLowerCase())),
              )
              .map(
                x =>
                  `<button class="mi" data-a="shareAdd" data-id="${p.id}" data-mid="${x.id}">${av(x.id, 'sm', false)}${esc(x.name)}<span class="r">${esc(x.email)}</span></button>`,
              )
              .join('') ||
            `<div class="mi faint" style="cursor:default">${S.ui.shareQ.includes('@') ? t('m.pressInvite', { email: esc(S.ui.shareQ) }) : t('m.noMatchingMembers')}</div>`
          }</div>`
        : ''
    }
    <div><div class="eyebrow" style="margin-bottom:4px">${t('m.peopleWithAccess')}</div>
      ${p.members
        .map(id => {
          const x = mem(id);
          if (!x) return '';
          const perm = id === p.lead ? 'Full access' : p.perms[id] || (x.role === 'Guest' ? 'Can comment' : 'Can edit');
          return `<div class="row" style="height:44px">${av(id, 'md', false)}<div class="grow"><div style="font-weight:500;font-size:13px">${esc(x.name)}${id === D().me ? ` <span class="faint" style="font-weight:400">${t('m.you')}</span>` : ''}</div><div class="faint" style="font-size:11.5px">${esc(x.email)}${id === p.lead ? t('m.projectLead') : ''}</div></div>
          ${id === p.lead ? `<span class="muted" style="font-size:12.5px;padding-inline-end:8px">Full access</span>` : `<select class="select" style="width:auto;height:26px;font-size:12px;border-color:transparent;background-color:transparent" data-in="sharePerm" data-id="${p.id}" data-mid="${id}" aria-label="${t('m.permissionFor', { name: esc(x.name) })}">${PERMS.map(q => `<option ${q === perm ? 'selected' : ''}>${q}</option>`).join('')}<option value="__remove">${t('m.removeAccess')}</option></select>`}</div>`;
        })
        .join('')}
    </div>
    <div style="border-top:1px solid var(--divider);padding-top:12px"><div class="eyebrow" style="margin-bottom:8px">${t('m.generalAccess')}</div>
      <div class="row" style="gap:10px"><span class="ftype" style="--c:var(--text-2)">${ic(p.access === 'private' ? 'lock' : 'building-2', 14)}</span><div class="grow"><select class="select" style="height:28px;width:auto;border-color:transparent;padding-inline-start:4px;font-weight:500" data-in="shareAccess" data-id="${p.id}" aria-label="${t('m.generalAccess')}"><option value="private" ${p.access === 'private' ? 'selected' : ''}>${t('m.onlyInvited')}</option><option value="workspace" ${p.access === 'workspace' ? 'selected' : ''}>${t('m.everyoneAt', { ws: esc(D().ws.name) })}</option></select><div class="faint" style="font-size:11.5px;padding-inline-start:4px">${p.access === 'private' ? t('m.onlyListedDesc') : t('m.anyoneCanView')}</div></div></div></div>
  </div>
  <div class="modal-f"><button class="btn btn-secondary" data-a="copyLink" data-pid="${p.id}">${ic('link', 14)}${t('m.copyLink')}</button><span class="sp"></span><button class="btn btn-primary" data-a="closeModal">${t('m.done')}</button></div>`;
}
export function addMemberModal(m, H) {
  const err = S.ui.errors.addMember;
  const draft = S.ui.addMemberDraft || {};
  const roles = me()?.role === 'Owner' ? ['Member', 'Admin', 'Guest', 'Owner'] : ['Member', 'Admin', 'Guest'];
  return `${H(t('m.addTitle', { ws: esc(D().ws.name) }), t('m.addSub'))}
  <form class="modal-b" data-submit="submitAddMember">
    <div class="field"><label class="label" for="add-email">${t('auth.email')}</label><input class="input ${err ? 'is-error' : ''}" id="add-email" type="email" autocomplete="off" value="${esc(draft.email || '')}" autofocus></div>
    <div class="field"><label class="label" for="add-name">${t('m.nameOptional')}</label><input class="input" id="add-name" autocomplete="off" value="${esc(draft.name || '')}"></div>
    <div class="field"><label class="label" for="add-password">${t('auth.password')}</label><input class="input" id="add-password" type="password" autocomplete="new-password"><span class="hint">${t('auth.pwHint')}</span></div>
    ${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : ''}
    <div class="row" style="gap:12px"><div class="field grow"><label class="label" for="add-role">${t('m.role')}</label><select class="select" id="add-role">${roles
      .map(r => `<option ${draft.role === r ? 'selected' : ''}>${r}</option>`)
      .join('')}</select></div>
    <div class="field grow"><label class="label" for="add-team">${t('m.team')}</label><select class="select" id="add-team">${teamsList()
      .map(tm => `<option value="${tm.id}" ${draft.team === tm.id ? 'selected' : ''}>${tm.name}</option>`)
      .join('')}</select></div></div>
    <div class="alert info">${ic('info', 14)}<span>${t('m.addInfo')}</span></div>
  </form>
  <div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal">${t('modal.cancel')}</button><button class="btn btn-primary" data-a="submitAddMember" id="add-submit">${t('m.addMember')}</button></div>`;
}
export function confirmModal(m) {
  const needs = m.typeName;
  const ok = !needs || (S.ui.confirmText || '') === needs;
  return `<div class="modal-b" style="padding-top:18px;gap:10px">
    <div class="row" style="gap:12px;align-items:flex-start"><span class="ftype" style="--c:${m.danger ? 'var(--red)' : 'var(--amber)'};width:34px;height:34px;border-radius:9px">${ic(m.icon || (m.danger ? 'trash-2' : 'archive'), 17)}</span>
    <div class="grow"><h2 id="mt-confirm" style="font-size:15px;font-weight:600;margin:4px 0 6px">${esc(m.title)}</h2><p class="muted" style="margin:0;font-size:13px;line-height:1.55">${m.body}</p></div></div>
    ${needs ? `<div class="field" style="margin-top:6px"><label class="label" for="confirm-in" style="font-weight:400;color:var(--text-2)">${t('m.confirmType', { name: `<b style="color:var(--text);font-weight:600">${esc(needs)}</b>` })}</label><input class="input" id="confirm-in" data-in="confirmText" autocomplete="off" autofocus value="${esc(S.ui.confirmText || '')}"></div>` : ''}
  </div>
  <div class="modal-f"><span class="sp"></span><button class="btn btn-secondary" data-a="closeModal" ${needs ? '' : 'autofocus'}>${t('modal.cancel')}</button><button class="btn ${m.danger ? 'btn-danger' : 'btn-primary'}" data-a="confirmOk" ${ok ? '' : 'disabled'}>${esc(m.ok)}</button></div>`;
}
export const SHORTCUTS = [
  [
    'shortcuts.group.general',
    [
      ['shortcuts.cmdmenu', [MOD, 'K']],
      ['shortcuts.search', ['/']],
      ['shortcuts.keys', ['?']],
      ['shortcuts.sidebar', ['[']],
      ['shortcuts.dark', [MOD, 'Shift', 'L']],
      ['shortcuts.close', ['Esc']],
    ],
  ],
  [
    'shortcuts.group.create',
    [
      ['shortcuts.newTask', ['N']],
      ['shortcuts.newProject', ['P']],
      ['shortcuts.submit', [MOD, '↵']],
      ['shortcuts.sendComment', [MOD, '↵']],
    ],
  ],
  [
    'shortcuts.group.navigate',
    [
      ['shortcuts.goHome', ['G', 'H']],
      ['shortcuts.goMyTasks', ['G', 'T']],
      ['shortcuts.goProjects', ['G', 'P']],
      ['shortcuts.goInbox', ['G', 'I']],
      ['shortcuts.goCalendar', ['G', 'C']],
      ['shortcuts.goSettings', ['G', 'S']],
    ],
  ],
  [
    'shortcuts.group.command',
    [
      ['shortcuts.moveSel', ['↑', '↓']],
      ['shortcuts.runCmd', ['↵']],
      ['shortcuts.searchMode', ['Tab']],
    ],
  ],
];
export function shortcutsModal(H) {
  return `${H(t('shortcuts.modal.title'))}<div class="modal-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px">${SHORTCUTS.map(([g, list]) => `<div><div class="eyebrow" style="margin-bottom:6px">${t(g)}</div>${list.map(([n, k]) => `<div class="row" style="height:30px;font-size:13px;border-bottom:1px solid var(--divider)"><span class="grow">${t(n)}</span>${k.map((x, i) => `${i && k[0] === 'G' ? `<span class="faint" style="font-size:11px">${t('shortcuts.then')}</span>` : ''}<kbd>${x}</kbd>`).join('')}</div>`).join('')}</div>`).join('')}</div>`;
}
export function filePreviewModal(m, H) {
  const f = m.file;
  const ft = FT[f.type] || FT.other;
  return `${H(esc(f.name), `${ft.n} · ${f.size} · ${t('m.uploadedBy', { name: esc(mem(f.by)?.name || t('m.youLower')), when: ago(f.at) })}`)}
  <div class="modal-b"><div style="border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">${filePrev(f).replace('class="fprev"', 'class="fprev" style="aspect-ratio:16/9"')}</div>
  ${m.tid ? `<div class="row faint" style="font-size:12.5px">${ic('link', 13)}${t('m.attachedTo')} <button class="link" data-a="openTask" data-id="${m.tid}">${esc(task(m.tid)?.title)}</button></div>` : ''}</div>
  <div class="modal-f"><button class="btn btn-secondary" data-a="copyLink" data-fid="${f.id}">${ic('link', 14)}${t('m.copyLink')}</button><span class="sp"></span><button class="btn btn-primary" data-a="closeModal">${t('modal.close')}</button></div>`;
}
