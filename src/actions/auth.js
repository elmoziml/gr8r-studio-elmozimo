import { $ } from '../core/utils.js';
import { S, hydrateServer, saveNow } from '../core/store.js';
import { t } from '../core/i18n.js';
import { go, render } from '../shell/render.js';
import { toast } from '../ui/toast.js';
import { backend } from '../api/backend.js';
import { A, EMAIL_RE, confirmDlg, enterApp } from './actions.js';

const demo = {
  switchWs: A.switchWs,
  delWorkspace: A.delWorkspace,
  resetDemo: A.resetDemo,
  startOnboarding: A.startOnboarding,
  newWorkspace: A.newWorkspace,
  onbFinish: A.onbFinish,
  savePassword: A.savePassword,
  revokeSession: A.revokeSession,
  revokeAll: A.revokeAll,
};

function setLoading(id, loading) {
  const button = document.getElementById(id);
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
  button.setAttribute('aria-busy', String(loading));
}

function loginError(error) {
  if (error.status === 0) return t('auth.err.server');
  if (error.status === 401) return t('auth.err.invalid');
  if (error.status === 429) return t('auth.err.rate');
  return error.message || t('auth.err.generic');
}

A.doLogin = async () => {
  const errors = (S.ui.errors = {});
  const email = $('#l-email').value.trim();
  const password = $('#l-pw').value;
  S.ui.af.email = email;
  if (!email) errors.email = t('auth.err.email');
  else if (!EMAIL_RE.test(email)) errors.email = t('auth.err.emailValid');
  if (!password) errors.pw = t('auth.err.pw');
  if (Object.keys(errors).length) {
    render();
    (errors.email ? $('#l-email') : $('#l-pw'))?.focus();
    return;
  }

  if (S.ui.authBusy) return;
  S.ui.authBusy = true;
  setLoading('login-btn', true);
  try {
    await backend.auth.login({ email, password });
    await hydrateServer();
    S.ui.authBusy = false;
    enterApp(t('auth.signedInAs', { email }));
  } catch (error) {
    S.ui.authBusy = false;
    S.ui.errors.login = loginError(error);
    setLoading('login-btn', false);
    render();
  }
};

A.signOut = async () => {
  S.ui.pop = null;
  S.ui.palette = null;
  S.ui.drawer = null;
  S.ui.modals = [];
  S.ui.authBusy = false;
  try {
    await backend.auth.logout();
  } catch {
    /* the local session is cleared below even if the API call fails */
  }
  S.mode = 'demo';
  S.ui.auth = 'login';
  S.ui.errors = {};
  S.ui.af = { email: '', name: '' };
  S.ui.showPw = false;
  S.ui.pwNew = '';
  render();
};

A.switchWs = async el => {
  if (S.mode !== 'server') return demo.switchWs(el);
  const id = el.dataset.v;
  S.ui.pop = null;
  if (!id || id === S.data.ws?.id) {
    render();
    return;
  }
  try {
    await saveNow();
    await backend.activateWorkspace(id);
    await hydrateServer();
    go('home');
    toast(t('toast.switchedWs', { name: S.data.ws.name }));
  } catch (error) {
    toast(error.message || t('save.failed'), { kind: 'err' });
    render();
  }
};

A.delWorkspace = () => {
  if (S.mode !== 'server') return demo.delWorkspace();
  const workspace = S.data.ws;
  if (!workspace?.id) {
    toast(t('save.failed'), { kind: 'err' });
    return;
  }
  confirmDlg({
    title: t('dlg.delWsTitle', { name: workspace.name }),
    body: t('dlg.delWsBody'),
    ok: t('dlg.delWsOk'),
    danger: true,
    typeName: workspace.name,
    run: async () => {
      try {
        await saveNow();
        await backend.deleteWorkspace(workspace.id);
        await hydrateServer();
        go('home');
        toast(t('toast.wsDeleted'), { kind: 'info', ms: 5000 });
      } catch (error) {
        toast(error.message || t('save.failed'), { kind: 'err' });
        render();
      }
    },
  });
};

A.resetDemo = () => {
  if (S.mode !== 'server') return demo.resetDemo();
  S.ui.pop = null;
  toast(t('toast.serverOnly'), { kind: 'info' });
  render();
};

A.startOnboarding = () => {
  if (S.mode !== 'server') return demo.startOnboarding();
  S.ui.pop = null;
  toast(t('toast.serverOnly'), { kind: 'info' });
  render();
};

A.newWorkspace = () => {
  if (S.mode !== 'server') return demo.newWorkspace();
  S.ui.pop = null;
  toast(t('toast.serverOnly'), { kind: 'info' });
  render();
};

A.onbFinish = () => {
  if (S.mode !== 'server') return demo.onbFinish();
  toast(t('toast.serverOnly'), { kind: 'info' });
};

A.savePassword = async () => {
  if (S.mode !== 'server') return demo.savePassword();
  const errors = (S.ui.errors = {});
  const current = $('#pw-cur').value;
  const next = $('#pw-new').value;
  const confirm = $('#pw-conf').value;
  S.ui.pwDone = false;
  if (!current) errors.pwCur = t('act.err.curPw');
  if (next.length < 10 || !/[0-9\W]/.test(next)) errors.pwNew = t('auth.err.pwWeak');
  if (next !== confirm) errors.pwConf = t('auth.err.pwMatch');
  if (Object.keys(errors).length) {
    render();
    return;
  }
  try {
    await backend.auth.changePassword({ currentPassword: current, newPassword: next });
    S.ui.pwDone = true;
    S.ui.pwNew = '';
    S.data.sessions = S.data.sessions.filter(session => session.cur);
    render();
    toast(t('auth.pwUpdated'));
  } catch (error) {
    if (error.status === 401) errors.pwCur = t('auth.err.curPwWrong');
    else errors.pwNew = error.message || t('auth.err.generic');
    render();
  }
};

A.revokeSession = async el => {
  if (S.mode !== 'server') return demo.revokeSession(el);
  const id = el.dataset.id;
  try {
    await backend.auth.revokeSession(id);
    S.data.sessions = S.data.sessions.filter(session => session.id !== id);
    render();
    toast(t('toast.sessionSignedOut'));
  } catch (error) {
    toast(error.message || t('save.failed'), { kind: 'err' });
  }
};

A.revokeAll = () => {
  if (S.mode !== 'server') return demo.revokeAll();
  confirmDlg({
    title: t('dlg.revokeAllTitle'),
    body: t('dlg.revokeAllBody'),
    ok: t('dlg.revokeAllOk'),
    danger: true,
    icon: 'log-out',
    run: async () => {
      try {
        await backend.auth.revokeOtherSessions();
        S.data.sessions = S.data.sessions.filter(session => session.cur);
        render();
        toast(t('toast.revokedOthers'));
      } catch (error) {
        toast(error.message || t('save.failed'), { kind: 'err' });
      }
    },
  });
};
