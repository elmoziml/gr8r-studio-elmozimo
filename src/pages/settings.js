/* =====================================================================
   SETTINGS · AUTH · ONBOARDING · DESIGN SYSTEM · SYSTEM STATES
   ===================================================================== */
import { dOff, esc, fmtDate } from '../core/utils.js';
import { ic, wsLogo } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { D, S, me } from '../core/store.js';
import { av, pIcon } from '../ui/helpers.js';
import { permsTable, teamsGrid } from './members.js';
import { page404 } from './errors.js';
import { SHORTCUTS } from '../overlays/modals.js';

export const SET_NAV = [
  [
    'set.nav.group.general',
    [
      ['workspace', 'set.nav.workspace', 'building-2'],
      ['appearance', 'set.nav.appearance', 'palette'],
      ['language', 'set.nav.language', 'languages'],
      ['datetime', 'set.nav.datetime', 'clock'],
    ],
  ],
  [
    'set.nav.group.workspace',
    [
      ['members', 'set.nav.members', 'users'],
      ['teams', 'set.nav.teams', 'users-round'],
      ['projects', 'set.nav.projects', 'folder-kanban'],
      ['permissions', 'set.nav.permissions', 'shield'],
    ],
  ],
  [
    'set.nav.group.notifications',
    [
      ['notif-email', 'set.nav.notifEmail', 'mail'],
      ['notif-push', 'set.nav.notifPush', 'smartphone'],
      ['notif-mentions', 'set.nav.notifMentions', 'at-sign'],
      ['notif-assign', 'set.nav.notifAssign', 'user-check'],
    ],
  ],
  [
    'set.nav.group.personal',
    [
      ['profile', 'set.nav.profile', 'user'],
      ['preferences', 'set.nav.preferences', 'sliders-horizontal'],
      ['shortcuts', 'set.nav.shortcuts', 'keyboard'],
    ],
  ],
  [
    'set.nav.group.security',
    [
      ['password', 'set.nav.password', 'key-round'],
      ['sessions', 'set.nav.sessions', 'monitor-smartphone'],
      ['2fa', 'set.nav.tfa', 'shield-check'],
    ],
  ],
  [
    'set.nav.group.billing',
    [
      ['plan', 'set.nav.plan', 'gem'],
      ['payment', 'set.nav.payment', 'credit-card'],
      ['invoices', 'set.nav.invoices', 'receipt'],
    ],
  ],
];
export function srow(title, d, ctl) {
  return `<div class="srow"><div><div class="t">${title}</div>${d ? `<div class="d">${d}</div>` : ''}</div><div class="row">${ctl}</div></div>`;
}
export const tog = (k, on, src = 'pref') =>
  `<input type="checkbox" class="toggle" data-in="${src}Toggle" data-k="${k}" ${on ? 'checked' : ''} aria-label="${k}">`;
export const sel = (k, opts, v) =>
  `<select class="select" style="width:auto;min-width:180px" data-in="prefSel" data-k="${k}" aria-label="${k}">${opts
    .map(o => {
      const [val, n] = Array.isArray(o) ? o : [o, o];
      return `<option value="${val}" ${String(v) === String(val) ? 'selected' : ''}>${n}</option>`;
    })
    .join('')}</select>`;
export function pageSettings() {
  const sec = S.ui.params.sec || S.ui.settings || 'appearance';
  const title = SET_NAV.flatMap(g => g[1]).find(x => x[0] === sec) || ['appearance', 'set.nav.appearance'];
  return `<div class="set">
    <nav class="set-nav" aria-label="${t('route.settings')}">${SET_NAV.map(([g, items]) => `<div class="gh">${t(g)}</div>${items.map(([k, n, i]) => `<button class="sitem ${sec === k ? 'on' : ''}" data-a="go" data-r="settings" data-sec="${k}">${ic(i, 15)}<span>${t(n)}</span></button>`).join('')}`).join('')}</nav>
    <div class="set-body" data-keep="set:${sec}"><div class="set-in">${settingsBody(sec, t(title[1]))}</div></div>
  </div>`;
}
export function settingsBody(sec, title) {
  const P = S.prefs;
  const d = D();
  const np = d.notifPrefs;
  const H = lead => `<h1>${title}</h1><p class="lead">${lead}</p>`;
  switch (sec) {
    case 'workspace':
      return (
        H(t('set.ws.lead')) +
        `
      <form data-submit="saveWorkspace">
      <div class="sblock" style="margin-top:0"><div class="row" style="gap:14px;margin-bottom:18px">${wsLogo(d.ws, 52)}<div><div class="label" style="margin-bottom:6px">${t('set.ws.icon')}</div><div class="swatches">${['#2F2E2A', '#5A67D8', '#3B82C4', '#23918A', '#C54B78', '#C48A1E'].map(c => `<button type="button" class="sw ${d.ws.c === c ? 'on' : ''}" style="--c:${c};width:22px;height:22px" data-a="wsColor" data-v="${c}" aria-label="${t('set.ws.colorAria', { c })}"></button>`).join('')}</div></div></div>
      <div class="col" style="gap:14px;max-width:440px"><div class="field"><label class="label" for="ws-name">${t('set.ws.name')}</label><input class="input" id="ws-name" value="${esc(d.ws.name)}"></div>
      <div class="field"><label class="label" for="ws-url">${t('set.ws.url')}</label><div class="row" style="gap:0"><span class="input" style="width:auto;background:var(--surface-2);border-inline-end:0;border-radius:6px 0 0 6px;display:flex;align-items:center;color:var(--text-2)">gr8rstudio.com/</span><input class="input" id="ws-url" value="${esc(d.ws.url)}" style="border-radius:0 6px 6px 0"></div><span class="hint">${t('set.ws.urlHint')}</span></div>
      <div><button class="btn btn-primary" data-a="saveWorkspace" id="ws-save">${t('set.ws.save')}</button></div></div></div></form>
      <div class="sblock"><h2 style="color:var(--red)">${t('set.ws.danger')}</h2>${srow(t('set.ws.delete'), t('set.ws.deleteDesc'), `<button class="btn btn-danger-ghost" style="border:1px solid color-mix(in srgb,var(--red) 35%,transparent)" data-a="delWorkspace">${t('set.ws.delete')}</button>`)}</div>`
      );
    case 'appearance':
      return (
        H(t('set.app.lead')) +
        `
      <div class="sblock" style="margin-top:0"><h2>${t('set.app.theme')}</h2><div class="themecards" style="margin-top:12px" role="radiogroup" aria-label="${t('set.app.theme')}">${[
        ['light', t('set.theme.light')],
        ['dark', t('set.theme.dark')],
        ['system', t('set.theme.system')],
      ]
        .map(([k, n]) => {
          const L = { bg: '#FBFAF8', s: '#F2F1EE', t: '#1D1C1A', b: '#E3E1DC', a: '#4B5BD6' },
            Dk = { bg: '#1D1D1C', s: '#151514', t: '#ECEAE5', b: '#333230', a: '#8E9AF3' };
          const pv = c =>
            `<div class="s" style="background:${c.s}"><i style="background:${c.b};width:70%"></i><i style="background:${c.a};width:55%"></i><i style="background:${c.b};width:80%"></i><i style="background:${c.b};width:60%"></i></div><div class="m" style="background:${c.bg}"><i style="background:${c.t};width:45%;height:7px"></i><i style="background:${c.b}"></i><i style="background:${c.b};width:80%"></i><i style="background:${c.a};width:30%;height:10px;margin-top:4px"></i></div>`;
          return `<button class="tcard ${P.theme === k ? 'on' : ''}" role="radio" aria-checked="${P.theme === k}" data-a="setTheme" data-v="${k}"><div class="tprev" style="${k === 'system' ? 'grid-template-columns:1fr 1fr;display:grid' : ''}">${k === 'system' ? `<div style="display:grid;grid-template-columns:30% 1fr">${pv(L)}</div><div style="display:grid;grid-template-columns:30% 1fr">${pv(Dk)}</div>` : pv(k === 'light' ? L : Dk)}</div><span class="row" style="font-weight:500;font-size:13px;gap:6px">${ic(k === 'light' ? 'sun' : k === 'dark' ? 'moon' : 'monitor', 14)}${n}${P.theme === k ? `<span class="sp"></span><span style="color:var(--accent)">${ic('circle-check', 15)}</span>` : ''}</span></button>`;
        })
        .join('')}</div></div>
      <div class="sblock"><h2>${t('set.app.accentColor')}</h2>${srow(
        t('set.app.accent'),
        t('set.app.accentDesc'),
        `<div class="swatches" role="radiogroup" aria-label="${t('set.app.accentColor')}">${[
          ['indigo', '#4B5BD6', t('set.color.indigo')],
          ['blue', '#2F6CD4', t('set.color.blue')],
          ['violet', '#7348CC', t('set.color.violet')],
          ['teal', '#1A7F7A', t('set.color.teal')],
          ['rose', '#B93D68', t('set.color.rose')],
          ['graphite', '#34332F', t('set.color.graphite')],
        ]
          .map(
            ([k, c, cn]) =>
              `<button class="sw ${P.accent === k ? 'on' : ''}" style="--c:${c}" role="radio" aria-checked="${P.accent === k}" data-a="setPref" data-k="accent" data-v="${k}" aria-label="${cn}" data-tip="${cn}">${P.accent === k ? ic('check', 13) : ''}</button>`,
          )
          .join('')}</div>`,
      )}</div>
      <div class="sblock"><h2>${t('set.app.density')}</h2>
        ${srow(
          t('set.app.side'),
          t('set.app.sideDesc'),
          `<div class="seg">${[
            ['comfortable', t('set.app.comfortable')],
            ['compact', t('set.app.compact')],
          ]
            .map(([k, n]) => `<button class="${P.side === k ? 'on' : ''}" data-a="setPref" data-k="side" data-v="${k}">${n}</button>`)
            .join('')}</div>`,
        )}
        ${srow(
          t('set.app.taskDisplay'),
          t('set.app.taskDisplayDesc'),
          `<div class="seg">${[
            ['comfortable', t('set.app.comfortable')],
            ['compact', t('set.app.compact')],
          ]
            .map(([k, n]) => `<button class="${P.density === k ? 'on' : ''}" data-a="setPref" data-k="density" data-v="${k}">${n}</button>`)
            .join('')}</div>`,
        )}
        ${srow(
          t('set.app.motion'),
          t('set.app.motionDesc'),
          sel(
            'motion',
            [
              ['system', t('set.app.followSystem')],
              ['reduce', t('set.app.reduceMotion')],
            ],
            P.motion,
          ),
        )}
      </div>`
      );
    case 'language':
      return (
        H(t('set.language'), t('set.languageDesc')) +
        srow(
          t('set.language'),
          t('set.languageDesc'),
          sel(
            'lang',
            [
              ['en', t('lang.en')],
              ['ar', t('lang.ar')],
            ],
            P.lang,
          ),
        ) +
        srow(t('set.spellcheck'), t('set.spellcheckDesc'), tog('spell', P.spell !== false))
      );
    case 'datetime':
      return (
        H(t('set.dt.lead')) +
        srow(
          t('set.dt.tz'),
          t('set.dt.tzDesc'),
          sel('tz', ['(GMT-08:00) Pacific Time', '(GMT-05:00) Eastern Time', '(GMT+00:00) London', '(GMT+01:00) Berlin', '(GMT+08:00) Singapore'], P.tz),
        ) +
        srow(
          t('set.dt.dateFmt'),
          t('set.dt.preview', { date: fmtDate(dOff(8)) }),
          sel(
            'dateFmt',
            [
              ['MMM d', 'Oct 1'],
              ['d/M', '1/10'],
              ['M/d', '10/1'],
              ['yyyy-MM-dd', '2026-10-01'],
            ],
            P.dateFmt,
          ),
        ) +
        srow(
          t('set.dt.weekStart'),
          t('set.dt.weekStartDesc'),
          sel(
            'weekStart',
            [
              ['1', t('set.dt.monday')],
              ['0', t('set.dt.sunday')],
              ['6', t('set.dt.saturday')],
            ],
            P.weekStart,
          ),
        ) +
        srow(
          t('set.dt.timeFmt'),
          '',
          sel(
            'timeFmt',
            [
              ['12', t('set.dt.h12')],
              ['24', t('set.dt.h24')],
            ],
            P.timeFmt || '12',
          ),
        )
      );
    case 'members':
      return (
        H(t('set.mem.access', { n: d.members.length, ws: esc(d.ws.name) })) +
        `<div class="row" style="margin-bottom:12px"><button class="btn btn-primary" data-a="invite">${ic('user-plus', 14)}${t('home.invite')}</button><button class="btn btn-secondary" data-a="go" data-r="members">${t('set.mem.directory')}</button></div>
      <div class="panel" style="overflow:hidden">${d.members.map(m => `<div class="mini" style="min-height:52px;cursor:default" data-ctx="member" data-id="${m.id}">${av(m.id, 'md', false)}<div class="grow"><div style="font-weight:500">${esc(m.name)}</div><div class="faint" style="font-size:12px">${esc(m.email)}</div></div>${m.status === 'invited' ? `<span class="badge amber">${t('set.mem.invited')}</span>` : ''}${m.role === 'Owner' ? `<span class="pillbtn">${ic('crown', 13)}${t('set.mem.owner')}</span>` : `<button class="pillbtn bordered" data-a="pop" data-pop="role" data-id="${m.id}">${m.role}${ic('chevron-down', 12)}</button>`}<button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="member" data-id="${m.id}" aria-label="${t('set.mem.options')}">${ic('ellipsis', 14)}</button></div>`).join('')}</div>`
      );
    case 'teams':
      return H(t('set.teams.lead')) + teamsGrid();
    case 'projects': {
      const arch = d.projects.filter(p => p.archived);
      return (
        H(t('set.proj.lead')) +
        srow(
          t('set.proj.defaultView'),
          t('set.proj.defaultViewDesc'),
          sel(
            'defaultTab',
            [
              ['board', t('onb.view.board')],
              ['list', t('onb.view.list')],
              ['table', t('onb.view.table')],
              ['overview', t('route.overview')],
              ['timeline', t('onb.view.timeline')],
            ],
            P.defaultTab || 'board',
          ),
        ) +
        srow(t('set.proj.showDone'), '', tog('showDoneBoard', P.showDoneBoard !== false)) +
        `<div class="sblock"><h2>${t('set.proj.archived')}</h2>${arch.length ? arch.map(p => `<div class="srow"><div class="row">${pIcon(p, '', 14)}<b style="font-weight:500">${esc(p.name)}</b></div><div class="row"><button class="btn btn-secondary btn-sm" data-a="restoreProject" data-id="${p.id}">${t('arch.restore')}</button><button class="btn btn-danger-ghost btn-sm" data-a="delProject" data-id="${p.id}">${t('set.proj.delete')}</button></div></div>`).join('') : `<p class="faint" style="padding:12px 0">${t('set.proj.noArchived')}</p>`}<div style="margin-top:12px"><button class="btn btn-secondary btn-sm" data-a="go" data-r="archive">${ic('archive', 13)}${t('set.proj.openArchive')}</button></div></div>`
      );
    }
    case 'permissions':
      return (
        H(t('set.perm.lead')) +
        srow(t('set.perm.create'), '', tog('permCreate', P.permCreate !== false)) +
        srow(t('set.perm.invite'), t('set.perm.inviteDesc'), tog('permGuests', P.permGuests !== false)) +
        srow(t('set.perm.public'), t('set.perm.publicDesc'), tog('permPublic', !!P.permPublic)) +
        `<div class="sblock"><h2>${t('set.perm.roles')}</h2><div style="margin-top:12px">${permsTable()}</div></div>`
      );
    case 'notif-email':
      return (
        H(t('set.ne.lead')) +
        srow(t('set.notif.mentions'), t('set.ne.mentionsDesc'), tog('email_mention', np.email_mention, 'np')) +
        srow(t('set.notif.assignments'), t('set.ne.assignDesc'), tog('email_assign', np.email_assign, 'np')) +
        srow(t('set.notif.comments'), t('set.ne.commentsDesc'), tog('email_comment', np.email_comment, 'np')) +
        srow(t('set.ne.digest'), t('set.ne.digestDesc'), tog('email_digest', np.email_digest, 'np'))
      );
    case 'notif-push':
      return (
        H(t('set.np.lead')) +
        srow(t('set.notif.mentions'), '', tog('push_mention', np.push_mention, 'np')) +
        srow(t('set.notif.assignments'), '', tog('push_assign', np.push_assign, 'np')) +
        srow(t('set.notif.comments'), '', tog('push_comment', np.push_comment, 'np')) +
        srow(t('set.np.due'), t('set.np.dueDesc'), tog('push_due', np.push_due, 'np'))
      );
    case 'notif-mentions':
      return (
        H(t('set.nm.lead')) +
        srow(t('set.nm.all'), '', tog('mention_all', np.mention_all, 'np')) +
        srow(t('set.nm.team'), t('set.nm.teamDesc'), tog('mention_team', np.mention_team !== false, 'np')) +
        srow(t('set.nm.ws'), t('set.nm.wsDesc'), tog('mention_ws', !!np.mention_ws, 'np'))
      );
    case 'notif-assign':
      return (
        H(t('set.na.lead')) +
        srow(t('set.na.self'), '', tog('assign_self', np.assign_self, 'np')) +
        srow(t('set.na.status'), '', tog('assign_status', np.assign_status !== false, 'np')) +
        srow(t('set.na.overdue'), '', tog('assign_over', np.assign_over !== false, 'np'))
      );
    case 'profile': {
      const err = S.ui.errors.pname2;
      return (
        H(t('set.pf.lead')) +
        `<form data-submit="saveProfile" class="col" style="gap:16px;max-width:440px">
      <div class="row" style="gap:14px">${av(d.me, 'xl', false)}<div><div class="label" style="margin-bottom:6px">${t('set.pf.avatar')}</div><div class="swatches">${['#5A67D8', '#C54B78', '#3B82C4', '#23918A', '#C48A1E', '#8662C9'].map(c => `<button type="button" class="sw ${me().c === c ? 'on' : ''}" style="--c:${c};width:22px;height:22px" data-a="avColor" data-v="${c}" aria-label="${t('set.pf.color')}"></button>`).join('')}</div></div></div>
      <div class="field"><label class="label" for="pf-name">${t('auth.fullName')}</label><input class="input ${err ? 'is-error' : ''}" id="pf-name" value="${esc(P.name)}">${err ? `<span class="err">${ic('circle-alert', 12)}${err}</span>` : ''}</div>
      <div class="field"><label class="label" for="pf-title">${t('set.pf.title')}</label><input class="input" id="pf-title" value="${esc(P.title)}"></div>
      <div class="field"><label class="label" for="pf-email">${t('auth.email')}</label><input class="input" id="pf-email" value="${esc(me().email)}" disabled><span class="hint">${t('set.pf.emailHint')}</span></div>
      <div><button class="btn btn-primary" data-a="saveProfile" id="pf-save">${t('set.pf.save')}</button></div></form>`
      );
    }
    case 'preferences':
      return (
        H(t('set.pref.lead')) +
        srow(
          t('set.pref.openOn'),
          t('set.pref.openOnDesc'),
          sel(
            'home',
            [
              ['home', t('route.home')],
              ['mytasks', t('route.mytasks')],
              ['inbox', t('route.inbox')],
            ],
            P.home,
          ),
        ) +
        srow(
          t('set.pref.openTasks'),
          t('set.pref.openTasksDesc'),
          sel(
            'openTasks',
            [
              ['drawer', t('set.pref.sidePanel')],
              ['full', t('set.pref.fullPage')],
            ],
            P.openTasks,
          ),
        ) +
        srow(t('set.pref.confirmDel'), '', tog('confirmDel', P.confirmDel !== false))
      );
    case 'shortcuts':
      return (
        H(t('shortcuts.modal.title')) +
        SHORTCUTS.map(
          ([g, list]) =>
            `<div class="sblock" style="margin-top:18px"><h2>${t(g)}</h2>${list.map(([n, k]) => `<div class="srow" style="padding:9px 0"><span>${t(n)}</span><span class="row" style="gap:4px">${k.map((x, i) => `${i && k[0] === 'G' ? `<span class="faint" style="font-size:11px">${t('shortcuts.then')}</span>` : ''}<kbd>${x}</kbd>`).join('')}</span></div>`).join('')}</div>`,
        ).join('')
      );
    case 'password': {
      const e = S.ui.errors;
      const pw = S.ui.pwNew || '';
      return (
        H(t('set.pw.lead')) +
        `${S.ui.pwDone ? `<div class="alert ok" style="margin-bottom:14px">${ic('circle-check', 15)}<span>${t('set.pw.updatedNote')}</span></div>` : ''}<form data-submit="savePassword" class="col" style="gap:14px;max-width:400px">
      <div class="field"><label class="label" for="pw-cur">${t('set.pw.cur')}</label><input type="password" class="input ${e.pwCur ? 'is-error' : ''}" id="pw-cur" autocomplete="current-password">${e.pwCur ? `<span class="err">${ic('circle-alert', 12)}${e.pwCur}</span>` : ''}</div>
      <div class="field"><label class="label" for="pw-new">${t('set.pw.new')}</label><input type="password" class="input ${e.pwNew ? 'is-error' : ''}" id="pw-new" data-in="pwStrength" value="${esc(pw)}" autocomplete="new-password">${strengthMeter(pw)}${e.pwNew ? `<span class="err">${ic('circle-alert', 12)}${e.pwNew}</span>` : `<span class="hint">${t('auth.pwHint')}</span>`}</div>
      <div class="field"><label class="label" for="pw-conf">${t('set.pw.confirm')}</label><input type="password" class="input ${e.pwConf ? 'is-error' : ''}" id="pw-conf" autocomplete="new-password">${e.pwConf ? `<span class="err">${ic('circle-alert', 12)}${e.pwConf}</span>` : ''}</div>
      <div><button class="btn btn-primary" data-a="savePassword" id="pw-save">${t('set.pw.update')}</button></div></form>`
      );
    }
    case 'sessions':
      return (
        H(t('set.ses.lead')) +
        d.sessions
          .map(s =>
            srow(
              `<span class="row" style="gap:8px">${ic(s.dev.includes('iPhone') ? 'smartphone' : 'monitor', 15)}${esc(s.dev)}${s.cur ? `<span class="badge green">${t('set.ses.thisDevice')}</span>` : ''}</span>`,
              `${esc(s.loc)} · ${esc(s.at)}`,
              s.cur ? '' : `<button class="btn btn-secondary btn-sm" data-a="revokeSession" data-id="${s.id}">${t('set.ses.signOut')}</button>`,
            ),
          )
          .join('') +
        `<div style="margin-top:16px"><button class="btn btn-danger-ghost" data-a="revokeAll" ${d.sessions.length > 1 ? '' : 'disabled'}>${t('set.ses.signOutAll')}</button></div>`
      );
    case '2fa':
      return (
        H(t('set.tfa.lead')) +
        (d.tfa
          ? `<div class="alert ok">${ic('shield-check', 16)}<div><b>${t('set.tfa.on')}</b><div class="muted">${t('set.tfa.onDesc')}</div></div></div><div class="sblock"><h2>${t('set.tfa.recovery')}</h2><p class="muted" style="font-size:13px">${t('set.tfa.recoveryDesc')}</p><div style="display:grid;grid-template-columns:repeat(2,max-content);gap:6px 28px;font-family:var(--mono);font-size:13px;padding:14px;border:1px solid var(--border);border-radius:var(--r);background:var(--sunken);user-select:all">${['7KQ2-M8PX', 'D4TN-9WRE', 'HV3C-QZ6L', 'P2YB-J7SK', 'R9FG-4NUD', 'X6MA-T3HE'].map(c => `<span>${c}</span>`).join('')}</div><div style="margin-top:14px"><button class="btn btn-danger-ghost" data-a="disable2fa">${t('set.tfa.turnOff')}</button></div></div>`
          : S.ui.tfaSetup
            ? `<div class="panel" style="padding:18px;display:flex;gap:20px;flex-wrap:wrap"><div style="width:132px;height:132px;display:grid;grid-template-columns:repeat(11,1fr);gap:1px;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--border)" aria-label="QR code">${Array.from(
                { length: 121 },
                (_, i) => {
                  const r = Math.floor(i / 11),
                    c = i % 11;
                  const f = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
                  const on = f ? !((r === 1 && c === 1) || (r === 1 && c === 9) || (r === 9 && c === 1)) : (i * 7919) % 13 < 6;
                  return `<i style="background:${on ? '#1D1C1A' : '#fff'}"></i>`;
                },
              ).join('')}</div>
        <div class="grow col" style="gap:10px;min-width:220px"><div><b>${t('set.tfa.step1')}</b><div class="muted" style="font-size:13px">${t('set.tfa.step1Desc')}</div></div><div><b>${t('set.tfa.step2')}</b></div><form data-submit="verify2fa" class="row"><input class="input mono ${S.ui.errors.tfa ? 'is-error' : ''}" id="tfa-code" inputmode="numeric" maxlength="6" placeholder="000000" style="width:130px;letter-spacing:.2em;font-size:15px" autofocus><button class="btn btn-primary" data-a="verify2fa">${t('set.tfa.verify')}</button><button type="button" class="btn btn-ghost" data-a="cancel2fa">${t('modal.cancel')}</button></form>${S.ui.errors.tfa ? `<span class="err">${ic('circle-alert', 12)}${S.ui.errors.tfa}</span>` : `<span class="hint">${t('set.tfa.anyDigits')}</span>`}</div></div>`
            : `<div class="panel" style="padding:18px" ><div class="row" style="gap:14px;align-items:flex-start"><span class="ftype" style="--c:var(--amber);width:36px;height:36px">${ic('shield-alert', 18)}</span><div class="grow"><b>${t('set.tfa.off')}</b><p class="muted" style="margin:4px 0 12px;font-size:13px">${t('set.tfa.offDesc')}</p><button class="btn btn-primary" data-a="setup2fa">${t('set.tfa.setup')}</button></div></div></div>`)
      );
    case 'plan':
      return (
        H(t('set.plan.lead')) +
        `<div class="panel" style="padding:18px;margin-bottom:18px"><div class="row" style="flex-wrap:wrap"><div><div class="eyebrow">${t('set.plan.current')}</div><div style="font-size:20px;font-weight:600;letter-spacing:-.015em;margin-top:4px">${esc(d.plan || 'Team')} <span class="muted" style="font-size:14px;font-weight:400">${t('set.plan.perMember')}</span></div><div class="muted" style="font-size:13px">${t('set.plan.renews', { date: fmtDate(dOff(7), true) })}</div></div><span class="sp"></span><button class="btn btn-secondary" data-a="go" data-r="settings" data-sec="invoices">${t('set.plan.viewInvoices')}</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-top:18px">${[
        [t('route.members'), d.members.length, 10, ''],
        [t('set.plan.storage'), 12.4, 100, ' GB'],
        [t('route.projects'), d.projects.length, 50, ''],
      ]
        .map(
          ([n, v, m, u]) =>
            `<div><div class="row" style="font-size:12.5px;margin-bottom:6px"><span class="muted">${n}</span><span class="sp"></span><span class="num">${t('set.plan.of', { v: v + u, m: m + u })}</span></div><div class="meter"><i style="width:${(v / m) * 100}%;${v / m > 0.75 ? 'background:var(--amber)' : ''}"></i></div></div>`,
        )
        .join('')}</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${[
        ['Free', '$0', ['set.plan.f.upTo3', 'set.plan.f.unlimTasks', 'set.plan.f.gb5']],
        ['Team', '$12', ['set.plan.f.upTo50', 'set.plan.f.timelines', 'set.plan.f.gb100', 'set.plan.f.guests']],
        ['Business', '$24', ['set.plan.f.unlimMembers', 'set.plan.f.advPerms', 'set.plan.f.saml', 'set.plan.f.tb1']],
      ]
        .map(([n, pr, fs]) => {
          const cur = (d.plan || 'Team') === n;
          return `<div class="plan ${cur ? 'cur' : ''}"><div class="row"><b>${n}</b>${cur ? `<span class="badge accent">${t('set.plan.currentBadge')}</span>` : ''}</div><div class="pr">${pr}<span class="muted" style="font-size:12.5px;font-weight:400">${t('set.plan.perMemberMo')}</span></div><ul>${fs.map(f => `<li>${ic('check', 13)}${t(f)}</li>`).join('')}</ul><div style="margin-top:8px">${cur ? `<button class="btn btn-secondary btn-block" disabled>${t('set.plan.current')}</button>` : `<button class="btn ${n === 'Business' ? 'btn-primary' : 'btn-secondary'} btn-block" data-a="changePlan" data-v="${n}">${n === 'Free' ? t('set.plan.downgrade') : t('set.plan.upgrade')}</button>`}</div></div>`;
        })
        .join('')}</div>`
      );
    case 'payment':
      return (
        H(t('set.pay.lead')) +
        srow(
          `<span class="row" style="gap:10px"><span class="ftype" style="--c:var(--blue)">${ic('credit-card', 15)}</span>${t('set.pay.visa')}</span>`,
          t('set.pay.expires'),
          `<button class="btn btn-secondary btn-sm" data-a="toastInfo" data-msg="${t('set.pay.updateMsg')}">${t('set.pay.update')}</button>`,
        ) +
        srow(t('set.pay.billingEmail'), t('set.pay.billingEmailDesc'), `<span class="muted" style="user-select:all">hello@gr8rstudio.com</span>`) +
        srow(
          t('set.pay.billingAddr'),
          '2150 Mission St, San Francisco, CA 94110',
          `<button class="btn btn-secondary btn-sm" data-a="toastInfo" data-msg="${t('set.pay.editMsg')}">${t('set.pay.edit')}</button>`,
        ) +
        srow(t('set.pay.taxId'), t('set.pay.taxIdDesc'), `<span class="muted">US EIN ••-•••4410</span>`)
      );
    case 'invoices':
      return (
        H(t('set.inv.lead')) +
        `<div class="panel" style="overflow-x:auto"><table class="perm-t" style="min-width:480px"><thead><tr><th style="padding-inline-start:14px">${t('set.inv.invoice')}</th><th style="text-align:start">${t('set.inv.date')}</th><th style="text-align:start">${t('set.inv.amount')}</th><th style="text-align:start">${t('set.inv.status')}</th></tr></thead><tbody>${d.invoices.map(i => `<tr><td style="padding-inline-start:14px" class="mono">${i.id}</td><td style="text-align:start" class="num">${fmtDate(i.date, true)}</td><td style="text-align:start" class="num">${i.amt}</td><td style="text-align:start"><span class="badge green">${ic('check', 11)}${i.st}</span></td></tr>`).join('')}</tbody></table></div>`
      );
  }
  return page404();
}
export function strengthMeter(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const c = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--green)', 'var(--green)'][s];
  const n = [t('set.pw.tooShort'), t('set.pw.weak'), t('set.pw.fair'), t('set.pw.good'), t('set.pw.strong')][s];
  return pw
    ? `<div class="row" style="gap:8px"><div class="strength grow" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i < s ? 'on' : ''}" style="--c:${c}"></i>`).join('')}</div><span style="font-size:11.5px;color:${c};width:60px;text-align:end">${n}</span></div>`
    : '';
}
