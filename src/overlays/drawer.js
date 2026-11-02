/* =====================================================================
   OVERLAYS: drawer, modals, popovers, context menus, command palette
   ===================================================================== */
import { MOD, TODAY, ago, diffD, esc, fmtDate, parse, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { D, S, commentsOf, isOver, mem, pColor, proj, task } from '../core/store.js';
import { FT, av, filePrev, fileType, fmtComment, lbl, progBar } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';
import { cellAssignee, cellDue, cellPrio, cellProject, cellStatus } from '../components/task-list.js';
import { modalHtml } from './modals.js';
import { popHtml } from './popovers.js';
import { paletteHtml } from './palette.js';
import { subtaskHtml } from '../features/subtasks.js';

export function renderLayer() {
  const u = S.ui;
  let h = '';
  if (u.drawer && task(u.drawer))
    h += (u.drawerFull ? `<div class="drawer-scrim full${u.fx.drawer ? ' enter' : ''}" data-a="closeDrawer"></div>` : '') + drawerHtml(task(u.drawer));
  u.modals.forEach((m, i) => {
    const en = u.fx.modal === i + 1;
    h += `<div class="scrim${en ? ' enter' : ''}" data-a="closeModal" style="z-index:${60 + i * 2}"></div><div class="modal-wrap" data-a="closeModalBg" style="z-index:${61 + i * 2}">${en ? modalHtml(m).replace('class="modal ', 'class="modal enter ') : modalHtml(m)}</div>`;
  });
  if (u.palette) h += `<div class="scrim" data-a="closePalette" style="z-index:89"></div>${paletteHtml()}`;
  if (u.pop) h += popHtml(u.pop);
  return h;
}

/* ---------------- TASK DRAWER ---------------- */
export function drawerHtml(tk) {
  const p = proj(tk.project);
  const u = S.ui;
  const cs = commentsOf(tk.id);
  const sd = tk.subtasks.filter(s => s.done).length;
  const acts = D().activity.filter(a => a.task === tk.id);
  const tab = u.drawerTab;
  const prop = (icon, label, val) => `<dt>${ic(icon, 14)}${label}</dt><dd>${val}</dd>`;
  const ups = (u.uploads || []).filter(x => x.task === tk.id);
  const ment =
    u.mention && u.mention.tid === tk.id
      ? D()
          .members.filter(
            m => m.name.toLowerCase().startsWith(u.mention.q.toLowerCase()) || m.name.split(' ')[1]?.toLowerCase().startsWith(u.mention.q.toLowerCase()),
          )
          .slice(0, 5)
      : [];
  const sub = u.subOpen && u.subOpen.tid === tk.id ? tk.subtasks.find(s => s.id === u.subOpen.sid) : null;
  return `<aside class="drawer ${u.drawerFull ? 'full' : ''} ${u.fx.drawer ? 'enter' : ''} ${u.fx.tabs ? 'fx-tabs' : ''}" role="dialog" aria-modal="${u.drawerFull}" aria-labelledby="d-h" tabindex="-1">
    <h2 class="sr" id="d-h">${sub ? t('drawer.subtaskTitle', { title: esc(sub.title) }) : t('drawer.taskTitle', { title: esc(tk.title) })}</h2>
    <div class="drawer-h">
      <button class="pillbtn" data-a="go" data-r="project" data-id="${p.id}" data-tab="board" style="font-size:12.5px"><span class="pdot" style="--c:${pColor(p)}"></span>${esc(p.name)}</button><span class="faint">/</span><span class="mono faint" style="font-size:11.5px;padding:0 6px">${tk.key}</span>
      <span class="sp"></span>
      <button class="btn btn-sm ${tk.status === 'done' ? 'btn-secondary' : 'btn-ghost'}" data-a="toggleDone" data-id="${tk.id}" style="${tk.status === 'done' ? 'color:var(--green)' : ''}">${ic(tk.status === 'done' ? 'circle-check' : 'circle', 14)}<span class="hide-m">${tk.status === 'done' ? t('drawer.completed') : t('drawer.markComplete')}</span></button>
      <button class="ibtn ibtn-sm" data-a="toggleFavTask" data-id="${tk.id}" data-tip="${tk.fav ? t('drawer.unfavorite') : t('drawer.favorite')}" aria-pressed="${tk.fav}" aria-label="${t('drawer.favorite')}" style="${tk.fav ? 'color:var(--amber)' : ''}">${ic('star', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="copyLink" data-id="${tk.id}" data-tip="${t('drawer.copyLink')}" aria-label="${t('drawer.copyLink')}">${ic('link', 15)}</button>
      <button class="ibtn ibtn-sm hide-m" data-a="toggleDrawerFull" data-tip="${u.drawerFull ? t('drawer.sidePanel') : t('drawer.fullPage')}" aria-label="${t('drawer.toggleFullPage')}">${ic(u.drawerFull ? 'minimize-2' : 'maximize-2', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="task" data-id="${tk.id}" aria-label="${t('drawer.more')}">${ic('ellipsis', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="closeDrawer" data-tip="${t('drawer.closeEsc')}" aria-label="${t('drawer.close')}">${ic('x', 16)}</button>
    </div>
    <div class="drawer-b" data-keep="drawer:${tk.id}${sub ? ':' + sub.id : ''}">${
      sub
        ? subtaskHtml(tk, sub)
        : `
      ${tk.status === 'done' ? `<div class="alert ok" style="margin-bottom:12px">${ic('circle-check', 15)}<span>${t('drawer.completed')} ${tk.completedAt ? ago(tk.completedAt) : ''}. <button class="link" data-a="toggleDone" data-id="${tk.id}">${t('drawer.reopenTask')}</button></span></div>` : isOver(tk) ? `<div class="alert danger" style="margin-bottom:12px">${ic('clock-alert', 15)}<span>${t('drawer.overdueBy', { n: -diffD(parse(tk.due), TODAY), s: -diffD(parse(tk.due), TODAY) > 1 ? 's' : '' })} <button class="link" data-a="pop" data-pop="date" data-field="due" data-id="${tk.id}">${t('drawer.reschedule')}</button></span></div>` : ''}
      <textarea class="ttl-edit" id="d-title" rows="1" data-autosize data-blur="commitDrawerTitle" data-key-enter="blur" data-id="${tk.id}" aria-label="${t('drawer.titleAria')}">${esc(tk.title)}</textarea>
      <dl class="kv" style="margin-top:12px;${u.drawerFull ? 'grid-template-columns:112px minmax(0,1fr) 112px minmax(0,1fr)' : ''}">
        ${prop('circle-dot', t('drawer.status'), cellStatus(tk))}
        ${prop('signal-high', t('drawer.priority'), cellPrio(tk))}
        ${prop('user', t('drawer.assignee'), cellAssignee(tk))}
        ${prop('calendar', t('drawer.dueDate'), cellDue(tk))}
        ${prop('calendar-arrow-up', t('drawer.startDate'), `<button class="pillbtn ${tk.start ? '' : 'empty'}" data-a="pop" data-pop="date" data-field="start" data-id="${tk.id}">${ic('calendar', 13)}${tk.start ? fmtDate(tk.start) : t('drawer.setDate')}</button>`)}
        ${prop('folder', t('drawer.project'), cellProject(tk))}
        ${prop('tag', t('drawer.labels'), `<button class="pillbtn ${tk.labels.length ? '' : 'empty'}" data-a="pop" data-pop="labels" data-id="${tk.id}" style="flex-wrap:wrap;height:auto;min-height:26px;padding:3px 7px">${tk.labels.length ? tk.labels.map(lbl).join('') : ic('tag', 13) + t('drawer.addLabels')}</button>`)}
        ${prop('repeat', t('drawer.repeat'), `<button class="pillbtn ${tk.recur ? '' : 'empty'}" data-a="pop" data-pop="recur" data-id="${tk.id}">${ic('repeat', 13)}${tk.recur || t('drawer.doesNotRepeat')}</button>`)}
        ${prop('timer', t('drawer.estimate'), `<button class="pillbtn ${tk.estimate ? '' : 'empty'}" data-a="pop" data-pop="estimate" data-id="${tk.id}">${ic('timer', 13)}${tk.estimate ? esc(tk.estimate) : t('drawer.addEstimate')}</button>`)}
        ${prop('git-branch', t('drawer.blockedBy'), `<button class="pillbtn ${tk.deps.length ? '' : 'empty'}" data-a="pop" data-pop="deps" data-id="${tk.id}" style="height:auto;min-height:26px;flex-wrap:wrap">${tk.deps.length ? tk.deps.map(d => (task(d) ? `<span class="depchip mono" style="font-size:11px;padding:1px 5px;border-radius:4px;background:var(--surface-3)">${task(d).key}</span><span class="trunc" style="max-width:160px">${esc(task(d).title)}</span>` : '')).join('') : ic('git-branch', 13) + t('drawer.none')}</button>`)}
      </dl>

      <div class="dsec"><div class="dsec-h"><h3 id="d-desc-l">${t('drawer.description')}</h3><div class="rte-tb" role="toolbar" aria-label="${t('drawer.formatting')}" aria-controls="d-desc">
          ${[
            ['bold', 'bold', t('drawer.bold')],
            ['italic', 'italic', t('drawer.italic')],
            ['insertUnorderedList', 'list', t('drawer.bulletedList')],
            ['insertOrderedList', 'list-ordered', t('drawer.numberedList')],
            ['formatBlock:h4', 'heading', t('drawer.heading')],
            ['createLink', 'link', t('drawer.link')],
          ]
            .map(([c, i, n]) => `<button class="ibtn ibtn-xs" data-cmd="${c}" data-tip="${n}" aria-label="${n}">${ic(i, 13)}</button>`)
            .join('')}
        </div></div>
        <div class="rte"><div class="rte-body" id="d-desc" contenteditable="true" data-rte="${tk.id}" data-ph="${t('drawer.descPh')}" role="textbox" aria-multiline="true" aria-labelledby="d-desc-l">${tk.desc}</div></div>
      </div>

      <div class="dsec"><div class="dsec-h"><h3>${t('drawer.subtasks')}</h3><span class="cnt num">${sd}/${tk.subtasks.length}</span>${tk.subtasks.length ? `<span style="width:90px;display:flex">${progBar(Math.round((sd / tk.subtasks.length) * 100), sd === tk.subtasks.length ? 'green' : '')}</span>` : ''}</div>
        ${tk.subtasks.map(s => `<div class="subt ${s.done ? 'done' : ''}${fxc('added', s.id)}${fxc('done', s.id)}"><input type="checkbox" class="check" ${s.done ? 'checked' : ''} data-a="toggleSub" data-id="${tk.id}" data-sid="${s.id}" aria-label="${t(s.done ? 'drawer.reopenSub' : 'drawer.completeSub', { title: esc(s.title) })}"><button class="s" data-a="openSub" data-id="${tk.id}" data-sid="${s.id}">${esc(s.title)}</button>${s.due ? `<span class="due ${!s.done && diffD(parse(s.due), TODAY) < 0 ? 'over' : ''}">${ic('calendar', 12)}${relDate(s.due)}</span>` : ''}${s.assignee ? av(s.assignee, 'sm') : ''}<button class="ibtn ibtn-xs x" data-a="openSub" data-id="${tk.id}" data-sid="${s.id}" aria-label="${t('drawer.openSubtask')}" tabindex="-1">${ic('chevron-right', 14, 'flip-rtl')}</button></div>`).join('')}
        <div class="subt" style="color:var(--text-3)">${ic('plus', 15)}<input class="inline-in" id="d-sub" data-key-enter="addSub" data-id="${tk.id}" placeholder="${t('drawer.addSubtask')}" aria-label="${t('drawer.addSubtask')}" style="font-size:13.5px"></div>
      </div>

      <div class="dsec"><div class="dsec-h"><h3>${t('drawer.attachments')}</h3><span class="cnt">${tk.attachments.length}</span><div class="acts"><label class="btn btn-sm btn-ghost" style="cursor:pointer">${ic('upload', 13)}${t('drawer.upload')}<input type="file" multiple hidden data-in="uploadFiles" data-task="${tk.id}" data-project="${tk.project}"></label></div></div>
        ${ups.map(x => `<div class="upl" style="margin-bottom:6px"><span class="ftype" style="--c:${FT[fileType(x.name)].c}">${ic(FT[fileType(x.name)].i, 14)}</span><div class="grow"><div class="row"><span class="trunc">${esc(x.name)}</span><span class="sp"></span><span class="faint num" id="upct-${x.id}" style="font-size:11px">${x.pct}%</span></div><div class="prog" style="margin-top:5px"><i id="upbar-${x.id}" style="width:${x.pct}%"></i></div></div></div>`).join('')}
        ${tk.attachments.length ? `<div class="att">${tk.attachments.map(f => `<div class="attc" data-a="filePreview" data-tid="${tk.id}" data-aid="${f.id}" role="button" tabindex="0">${filePrev(f)}<div class="fi"><div class="trunc" style="font-weight:500">${esc(f.name)}</div><div class="faint">${FT[f.type]?.n || t('drawer.file')} · ${f.size}</div></div><button class="ibtn ibtn-xs x" data-a="rmAttach" data-id="${tk.id}" data-aid="${f.id}" aria-label="${t('drawer.removeAttachment')}">${ic('x', 12)}</button></div>`).join('')}</div>` : !ups.length ? `<label class="dropzone" style="padding:12px" data-dropzone-task="${tk.id}">${ic('paperclip', 15)}<span>${t('drawer.dropFiles')}</span><input type="file" multiple hidden data-in="uploadFiles" data-task="${tk.id}" data-project="${tk.project}"></label>` : ''}
      </div>

      <div class="dsec">
        <div class="tabs" style="margin-bottom:6px">${[
          ['comments', t('drawer.comments'), cs.length],
          ['activity', t('drawer.activity'), acts.length],
        ]
          .map(
            ([k, n, c]) =>
              `<button class="tab ${tab === k ? 'on' : ''}" data-a="set" data-k="drawerTab" data-v="${k}">${n}<span class="cnt">${c}</span></button>`,
          )
          .join('')}</div>
        ${
          tab === 'comments'
            ? `
          ${cs.length ? cs.map(commentHtml).join('') : `<p class="faint" style="font-size:13px;margin:10px 0">${t('drawer.noComments')}</p>`}
          <div class="row" style="align-items:flex-start;gap:10px;margin-top:8px">${av(D().me, 'md', false)}<div class="grow" style="position:relative">
            <div class="cbox"><textarea id="d-cmt" data-in="draft" data-id="${tk.id}" data-key-mod-enter="postComment" placeholder="${t('drawer.commentPh')}" aria-label="${t('drawer.comment')}" rows="2" data-autosize>${esc(u.drafts[tk.id] || '')}</textarea>
            <div class="row"><button class="ibtn ibtn-xs" data-a="insertAt" data-id="${tk.id}" data-tip="${t('drawer.mentionSomeone')}" aria-label="${t('drawer.mention')}">${ic('at-sign', 14)}</button><label class="ibtn ibtn-xs" data-tip="${t('drawer.attachFile')}" style="cursor:pointer">${ic('paperclip', 14)}<input type="file" multiple hidden data-in="uploadFiles" data-task="${tk.id}" data-project="${tk.project}"></label><span class="sp"></span><span class="faint hide-m" style="font-size:11px">${MOD}+Enter</span><button class="btn btn-primary btn-sm" data-a="postComment" data-id="${tk.id}">${t('drawer.comment')}</button></div></div>
            ${ment.length ? `<div class="pop" style="position:absolute;top:auto;bottom:calc(100% + 4px);inset-inline-start:0">${ment.map(m => `<button class="mi" data-a="pickMention" data-id="${tk.id}" data-name="${esc(m.name)}">${av(m.id, 'sm', false)}${esc(m.name)}<span class="r">${esc(m.title)}</span></button>`).join('')}</div>` : ''}
          </div></div>`
            : `
          <div style="padding-top:4px">${acts.map(a => `<div class="act-line"><span class="ico">${av(a.by, 'sm', false)}</span><span class="grow"><b>${esc(mem(a.by)?.id === D().me ? t('drawer.you') : mem(a.by)?.name)}</b> ${esc(a.verb.replace(/ of$/, ''))}${a.extra ? ' ' + esc(a.extra) : ''}</span><time class="faint" style="font-size:11.5px">${ago(a.at)}</time></div>`).join('')}
          <div class="act-line"><span class="ico">${ic('plus', 13)}</span><span class="grow">${t('drawer.taskCreated')}</span><time class="faint" style="font-size:11.5px">${ago(tk.created)}</time></div></div>`
        }
      </div>`
    }
    </div>
  </aside>`;
}
export function commentHtml(c) {
  const m = mem(c.by);
  const mine = c.by === D().me;
  return `<div class="cmt">${av(c.by, 'md', false)}<div class="body"><div class="who"><b>${esc(m?.name)}</b><time>${ago(c.at)}</time>${mine ? `<span class="sp"></span><button class="ibtn ibtn-xs" data-a="delComment" data-id="${c.id}" aria-label="${t('drawer.deleteComment')}" data-tip="${t('drawer.delete')}">${ic('trash-2', 12)}</button>` : ''}</div><div class="txt">${fmtComment(c.text)}</div>
    <div class="reacts">${Object.entries(c.re || {})
      .filter(([, v]) => v.length)
      .map(
        ([e, v]) =>
          `<button class="react ${v.includes(D().me) ? 'mine' : ''}" data-a="react" data-id="${c.id}" data-e="${e}" aria-label="${e} ${v.length}" title="${v.map(i => mem(i)?.name).join(', ')}">${e}<span class="num">${v.length}</span></button>`,
      )
      .join(
        '',
      )}<button class="react" data-a="pop" data-pop="emoji" data-id="${c.id}" aria-label="${t('drawer.addReaction')}" style="color:var(--text-3)">${ic('smile-plus', 13)}</button></div></div></div>`;
}
