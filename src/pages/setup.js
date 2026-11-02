import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { t } from '../core/i18n.js';
import { S } from '../core/store.js';
import { authShell } from './auth.js';

const field = (key, label, opts = {}) => {
  const value = S.ui.setup.form[key] ?? '';
  return `<div class="field"><label class="label" for="setup-${key}">${label}</label><input class="input ${opts.lg ? 'input-lg' : ''}" id="setup-${key}" data-in="setupField" data-f="${key}" type="${opts.type || 'text'}" value="${esc(value)}" placeholder="${esc(opts.placeholder || '')}" autocomplete="${opts.autocomplete || 'off'}"></div>`;
};

const errorBox = () => (S.ui.setup.error ? `<div class="alert danger" role="alert">${ic('circle-alert', 15)}<span>${esc(S.ui.setup.error)}</span></div>` : '');

const noteBox = () => (S.ui.setup.message ? `<div class="alert info" role="status">${ic('info', 15)}<span>${esc(S.ui.setup.message)}</span></div>` : '');

const button = (action, label, opts = {}) =>
  `<button class="btn ${opts.secondary ? 'btn-secondary' : 'btn-primary'} btn-lg ${opts.block ? 'btn-block' : ''}" data-a="${action}" ${S.ui.setup.busy ? 'disabled' : ''}>${S.ui.setup.busy && opts.busyLabel ? opts.busyLabel : label}</button>`;

export function renderSetup() {
  const st = S.ui.setup;
  const status = st.status || {};
  const step = st.step;
  const subtitle = `${t('setup.step')} ${step === 3 ? 2 : 1} / 2`;

  if (step === 'offline')
    return authShell(
      `<div class="auth-card"><div style="display:flex;justify-content:center"><span class="ftype" style="--c:var(--red);width:48px;height:48px;border-radius:12px">${ic('server-off', 22)}</span></div>
      <h1>${t('setup.offline.title')}</h1><p class="sub">${t('setup.offline.sub')}</p>
      <div class="alert danger">${ic('circle-alert', 15)}<span>${esc(st.error || t('setup.offline.error'))}</span></div>
      <div class="panel" style="padding:12px 14px"><code style="font-size:12.5px">npm run dev</code><p class="hint" style="margin:6px 0 0">${t('setup.offline.hint')}</p></div>
      <div class="row" style="margin-top:10px"><button class="btn btn-secondary btn-lg" data-a="setupDemo">${t('setup.offline.demo')}</button><span class="sp"></span><button class="btn btn-primary btn-lg" data-a="setupReload">${t('setup.reload')}</button></div></div>`,
    );

  if (step === 'env')
    return authShell(
      `<div class="auth-card"><div style="display:flex;justify-content:center"><span class="ftype" style="--c:var(--amber);width:48px;height:48px;border-radius:12px">${ic('settings-2', 22)}</span></div>
      <h1>${t('setup.env.title')}</h1><p class="sub">${t('setup.env.sub')}</p>
      ${errorBox()}${noteBox()}
      <div class="panel" style="padding:12px 14px"><code style="font-size:12px;word-break:break-all">DATABASE_URL=postgresql://...</code><p class="hint" style="margin:8px 0 0">${t('setup.env.hint')}</p></div>
      <div class="row" style="margin-top:10px"><button class="btn btn-secondary btn-lg" data-a="setupDemo">${t('setup.offline.demo')}</button><span class="sp"></span><button class="btn btn-primary btn-lg" data-a="setupReload">${t('setup.reload')}</button></div></div>`,
    );

  if (step === 'done')
    return authShell(
      `<div class="auth-card"><div style="display:flex;justify-content:center"><span class="ftype" style="--c:var(--green);width:48px;height:48px;border-radius:12px">${ic('circle-check', 22)}</span></div>
      <h1>${t('setup.done.title')}</h1><p class="sub">${t('setup.done.sub')}</p>
      <button class="btn btn-primary btn-lg btn-block" data-a="setupLogin">${t('setup.login')}</button></div>`,
    );

  if (step === 2)
    return authShell(
      `<div class="auth-card"><h1>${t('setup.schema.title')}</h1><p class="sub">${subtitle}</p>
      ${errorBox()}${noteBox()}
      <div class="panel" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px">
        <div class="row" style="justify-content:space-between"><span class="muted">${t('setup.status.database')}</span><b>${status.connected ? t('setup.connected') : t('setup.disconnected')}</b></div>
        <div class="row" style="justify-content:space-between"><span class="muted">${t('setup.status.tables')}</span><b>${status.tables ?? 0}</b></div>
        <div class="row" style="justify-content:space-between"><span class="muted">${t('setup.status.migrations')}</span><b>${status.migrations ? `${status.migrations.applied}/${status.migrations.total}` : '—'}</b></div>
      </div>
      ${field('token', t('setup.token'), { lg: true, type: 'password', placeholder: t('setup.tokenHint') })}
      <div class="row" style="margin-top:10px">${button('setupTest', t('setup.test'), { secondary: true, busyLabel: t('setup.testing') })}<span class="sp"></span>${button('setupMigrate', t('setup.schema.create'), { busyLabel: t('setup.schema.creating') })}</div></div>`,
    );

  if (step === 3)
    return authShell(
      `<div class="auth-card"><h1>${t('setup.admin.title')}</h1><p class="sub">${subtitle}</p>
      ${errorBox()}${noteBox()}
      ${field('adminName', t('setup.admin.name'), { lg: true, placeholder: t('setup.admin.namePlaceholder'), autocomplete: 'name' })}
      ${field('adminEmail', t('setup.admin.email'), { lg: true, type: 'email', placeholder: 'you@company.com', autocomplete: 'email' })}
      ${field('adminPassword', t('setup.admin.password'), { lg: true, type: 'password', autocomplete: 'new-password' })}
      ${field('workspaceName', t('setup.workspace.name'), { lg: true, placeholder: 'My Workspace' })}
      ${field('token', t('setup.token'), { lg: true, type: 'password', placeholder: t('setup.tokenHint') })}
      <label class="row" style="font-size:13px;gap:8px;cursor:pointer;margin-top:4px"><input type="checkbox" class="check" data-in="setupField" data-f="demoData" ${S.ui.setup.form.demoData ? 'checked' : ''}>${t('setup.demo')}</label>
      <p class="hint">${t('setup.demoHint')}</p>
      <div class="row" style="margin-top:10px">${button('setupBack', t('setup.back'), { secondary: true })}<span class="sp"></span>${button('setupInstall', t('setup.install'), { busyLabel: t('setup.installing') })}</div></div>`,
    );

  return '';
}
