/* ---------------- AUTH ---------------- */
import { esc } from '../core/utils.js';
import { LOGO, ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { D, S } from '../core/store.js';
import { effectiveDark } from '../core/theme.js';
import { TEMPLATES } from '../overlays/modals.js';

export function authShell(inner, topRight = '') {
  return `<div class="auth"><div class="auth-top"><span class="brand">${LOGO(22)}</span><div class="row">${topRight}<button class="ibtn" data-a="toggleDark" data-tip="${t('auth.toggleTheme')}" aria-label="${t('auth.toggleTheme')}">${ic(effectiveDark() ? 'sun' : 'moon', 16)}</button></div></div>
    <div class="auth-c">${inner}</div>
    <div class="auth-foot" style="padding:18px;font-size:12px" ><span class="faint">© 2026 Gr8r Studio · ${t('auth.terms')} · ${t('auth.privacy')}</span></div></div>`;
}
export const ferr = k => (S.ui.errors[k] ? `<span class="err" id="${k}-err">${ic('circle-alert', 12)}${S.ui.errors[k]}</span>` : '');
export const icls = k => (S.ui.errors[k] ? 'is-error' : '');
export function renderAuth() {
  const s = S.ui.auth;
  const e = S.ui.errors;
  const f = S.ui.af || (S.ui.af = { email: '', name: '' });
  if (s === 'onboarding') return renderOnboarding();
  if (s === 'login')
    return authShell(
      `<form class="auth-card${S.ui.fx.auth ? ' fx-auth' : ''}" data-submit="doLogin" novalidate>
    <div style="display:flex;justify-content:center">${LOGO(30)}</div><h1>${t('auth.welcomeBack')}</h1><p class="sub">${t('auth.signInTo', { ws: esc(D().ws.name) })}</p>
    ${e.login ? `<div class="alert danger" role="alert">${ic('circle-alert', 15)}<span>${e.login}</span></div>` : ''}
    <div class="field"><label class="label" for="l-email">${t('auth.email')}</label><input class="input input-lg ${icls('email')}" id="l-email" type="email" value="${esc(f.email || '')}" autocomplete="email" aria-invalid="${!!e.email}" aria-describedby="email-err">${ferr('email')}</div>
    <div class="field"><label class="label" for="l-pw">${t('auth.password')}</label>
      <div class="inwrap"><input class="input input-lg ${icls('pw')}" id="l-pw" type="${S.ui.showPw ? 'text' : 'password'}" autocomplete="current-password" style="padding-inline-end:38px" aria-invalid="${!!e.pw}"><button type="button" class="ibtn ibtn-sm" style="position:absolute;inset-inline-end:5px" data-a="toggleShowPw" aria-label="${S.ui.showPw ? t('auth.hidePw') : t('auth.showPw')}">${ic(S.ui.showPw ? 'eye-off' : 'eye', 15)}</button></div>${ferr('pw')}</div>
    <button class="btn btn-primary btn-lg btn-block" data-a="doLogin" id="login-btn">${t('auth.signIn')}</button></form>`,
    );
  return '';
}

/* ---------------- ONBOARDING ---------------- */
export function renderOnboarding() {
  const st = S.ui.onb;
  const o = S.ui.onbData;
  const N = 6;
  const nav = (next = t('onb.continue'), skip = false) =>
    `<div class="row" style="margin-top:6px">${st > 0 && st < 5 ? `<button class="btn btn-ghost" data-a="onbBack">${ic('arrow-left', 14, 'flip-rtl')}${t('onb.back')}</button>` : ''}<span class="sp"></span>${skip ? `<button class="btn btn-ghost" data-a="onbNext" data-skip="1">${t('onb.skip')}</button>` : ''}<button class="btn btn-primary btn-lg" data-a="onbNext" id="onb-next">${next}${ic('arrow-right', 15, 'flip-rtl')}</button></div>`;
  const opt = (k, v, icon, n, s) =>
    `<button class="opt ${o[k] === v ? 'on' : ''}" role="radio" aria-checked="${o[k] === v}" data-a="onbSet" data-k="${k}" data-v="${v}">${ic(icon, 18)}<b>${n}</b>${s ? `<span>${s}</span>` : ''}</button>`;
  let body;
  if (st === 0)
    body = `<h1>${t('onb.whatWorking')}</h1><p class="sub">${t('onb.whatSub')}</p><div class="opts" role="radiogroup">${[
      ['product', 'target', t('onb.use.product'), t('onb.use.productSub')],
      ['design', 'palette', t('onb.use.design'), t('onb.use.designSub')],
      ['marketing', 'megaphone', t('onb.use.marketing'), t('onb.use.marketingSub')],
      ['engineering', 'code', t('onb.use.engineering'), t('onb.use.engineeringSub')],
      ['personal', 'user', t('onb.use.personal'), t('onb.use.personalSub')],
      ['other', 'sparkles', t('onb.use.other'), t('onb.use.otherSub')],
    ]
      .map(x => opt('use', ...x))
      .join('')}</div>${nav()}`;
  if (st === 1) {
    const e = S.ui.errors.ws;
    body = `<h1>${t('onb.createWs')}</h1><p class="sub">${t('onb.wsSub')}</p>
    <div class="field"><label class="label" for="o-ws">${t('onb.wsName')}</label><input class="input input-lg ${e ? 'is-error' : ''}" id="o-ws" data-in="onbWs" value="${esc(o.ws)}" placeholder="e.g. Gr8r Studio" autofocus>${e ? `<span class="err">${ic('circle-alert', 12)}${e}</span>` : ''}</div>
    <div class="field"><label class="label" for="o-url">${t('onb.wsUrl')}</label><div class="row" style="gap:0"><span class="input input-lg" style="width:auto;background:var(--surface-2);border-inline-end:0;border-radius:6px 0 0 6px;display:flex;align-items:center;color:var(--text-2)">gr8rstudio.com/</span><input class="input input-lg" id="o-url" value="${esc(o.url || '')}" data-in="onbUrl" style="border-radius:0 6px 6px 0" placeholder="gr8rstudio"></div>${o.url ? `<span class="hint" style="color:var(--green);display:flex;gap:4px;align-items:center">${ic('check', 12)}${t('onb.available', { url: 'gr8rstudio.com/' + esc(o.url) })}</span>` : ''}</div>${nav()}`;
  }
  if (st === 2)
    body = `<h1>${t('onb.teamWork')}</h1><p class="sub">${t('onb.teamSub')}</p><div class="opts" role="radiogroup" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[
      ['kanban', 'square-kanban', t('onb.boards'), t('onb.boardsSub')],
      ['list', 'list-checks', t('onb.lists'), t('onb.listsSub')],
      ['timeline', 'chart-gantt', t('onb.timelines'), t('onb.timelinesSub')],
      ['table', 'table-2', t('onb.tables'), t('onb.tablesSub')],
    ]
      .map(x => opt('team', ...x))
      .join('')}</div>
    <div class="field"><span class="label">${t('onb.teamSize')}</span><div class="seg" style="width:fit-content">${[t('onb.size.justMe'), '2-10', '11-50', '51-200', '200+'].map(s => `<button class="${o.size === s ? 'on' : ''}" data-a="onbSet" data-k="size" data-v="${s}">${s}</button>`).join('')}</div></div>${nav()}`;
  if (st === 3)
    body = `<h1>${t('onb.firstProj')}</h1><p class="sub">${t('onb.firstSub')}</p><div class="field"><label class="label" for="o-proj">${t('onb.projName')}</label><input class="input input-lg" id="o-proj" data-in="onbProj" value="${esc(o.proj)}" autofocus></div><div class="tmpls" role="radiogroup">${TEMPLATES.filter(
      tm => tm.id !== 'blank',
    )
      .map(tm => opt('tmpl', tm.id, tm.icon, tm.name, `${tm.tasks.length} ${t('onb.starterTasks')}`))
      .join('')}</div>${nav()}`;
  if (st === 4)
    body = `<h1>${t('onb.inviteTitle')}</h1><p class="sub">${t('onb.inviteSub')}</p><div class="col" style="gap:8px">${[0, 1, 2].map(i => `<input class="input input-lg" id="o-inv-${i}" placeholder="teammate@company.com" type="email" value="${esc((o.invites || '').split(',')[i] || '')}" data-in="onbInv" data-i="${i}" aria-label="${t('onb.teammateEmail', { i: i + 1 })}">`).join('')}</div><button class="btn btn-ghost btn-sm" style="align-self:flex-start" data-a="copyInviteLink">${ic('link', 13)}${t('onb.copyLink')}</button>${nav(t('onb.sendInvites'), true)}`;
  if (st === 5) {
    const n = (o.invites || '').split(',').filter(x => x.includes('@')).length;
    body = `<div style="display:flex;justify-content:center"><span class="ftype ready-badge" style="--c:var(--green);width:48px;height:48px;border-radius:12px">${ic('circle-check', 22)}</span></div><h1>${t('onb.ready')}</h1><p class="sub">${t('onb.readySub')}</p>
    <div class="panel">${[
      ['building-2', t('onb.wsLabel', { name: esc(o.ws || 'My Workspace') }), 'gr8rstudio.com/' + esc(o.url || 'workspace')],
      [
        TEMPLATES.find(tm => tm.id === o.tmpl)?.icon || 'folder',
        t('onb.projLabel', { name: esc(o.proj) }),
        `${TEMPLATES.find(tm => tm.id === o.tmpl)?.tasks.length || 0} ${t('onb.starterTasks')} · ${t({ kanban: 'onb.view.board', list: 'onb.view.list', timeline: 'onb.view.timeline', table: 'onb.view.table' }[o.team])} ${t('onb.view.word')}`,
      ],
      ['user-plus', n ? t('onb.invitesSent', { n, s: n > 1 ? 's' : '' }) : t('onb.noInvites'), n ? t('onb.appearMembers') : t('onb.inviteAny')],
    ]
      .map(
        ([i, tt, s]) =>
          `<div class="row ready-row" style="padding:12px 14px;border-top:1px solid var(--divider);gap:12px"><span class="ftype" style="--c:var(--accent)">${ic(i, 14)}</span><div class="grow"><div style="font-weight:500">${tt}</div><div class="faint" style="font-size:12px">${s}</div></div><span class="ok" style="color:var(--green);display:inline-flex">${ic('check', 15)}</span></div>`,
      )
      .join('')}</div>
    <button class="btn btn-primary btn-lg btn-block" data-a="onbFinish">${t('onb.openWs')}${ic('arrow-right', 15, 'flip-rtl')}</button>`;
  }
  return authShell(
    `<div class="auth-card onb${S.ui.fx.step ? ' fx-step' : ''}" style="max-width:${st === 5 ? 440 : 560}px">
    <div class="steps" aria-label="${t('onb.stepOf', { n: st + 1, total: N })}">${Array.from({ length: N }, (_, i) => `<i class="${i <= st ? 'on' : ''} ${i === st ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="faint" style="text-align:center;font-size:12px">${t('onb.stepOf', { n: st + 1, total: N })}</div>
    ${body}</div>`,
    `<button class="btn btn-ghost btn-sm" data-a="onbExit">${t('onb.exitSetup')}</button>`,
  );
}
