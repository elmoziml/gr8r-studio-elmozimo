import { S, hydrate } from '../core/store.js';
import { t } from '../core/i18n.js';
import { render } from '../shell/render.js';
import { backend } from '../api/backend.js';
import { A, IN } from './actions.js';

const setup = () => S.ui.setup;
const form = () => setup().form;
const token = () => form().token || undefined;

export function setupState(status) {
  const error = status?.error || null;
  let step = 'env';
  if (status?.initialized) step = 'auth';
  else if (status?.configured) step = status.schemaReady ? 3 : 2;
  return {
    status: status || {},
    step,
    busy: false,
    error,
    message: null,
    form: {
      token: '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      workspaceName: 'My Workspace',
      demoData: true,
    },
  };
}

async function withBusy(fn) {
  const st = setup();
  if (!st || st.busy) return;
  st.busy = true;
  st.error = null;
  st.message = null;
  render();
  try {
    await fn();
  } catch (error) {
    st.error = error.message || t('setup.error');
  } finally {
    st.busy = false;
    render();
  }
}

IN.setupField = el => {
  const value = el.type === 'checkbox' ? el.checked : el.value;
  form()[el.dataset.f] = value;
  if (el.type === 'checkbox' || el.tagName === 'SELECT') render();
};

A.setupTest = () =>
  withBusy(async () => {
    const info = await backend.setup.testConnection(token());
    setup().message = t('setup.connectionOk', { database: info.database, user: info.user });
  });

A.setupMigrate = () =>
  withBusy(async () => {
    const result = await backend.setup.migrate(token());
    setup().status = result.status;
    setup().step = 3;
    setup().message = t('setup.schema.created');
  });

A.setupInstall = () =>
  withBusy(async () => {
    const f = form();
    if (!f.adminName.trim()) throw new Error(t('setup.error.adminName'));
    if (!/^\S+@\S+\.\S+$/.test(f.adminEmail.trim())) throw new Error(t('setup.error.adminEmail'));
    if (f.adminPassword.length < 10 || !/[0-9\W]/.test(f.adminPassword)) throw new Error(t('setup.error.adminPassword'));
    const result = await backend.setup.install(
      {
        admin: { name: f.adminName.trim(), email: f.adminEmail.trim(), password: f.adminPassword },
        workspace: { name: f.workspaceName.trim() || 'My Workspace' },
        demoData: Boolean(f.demoData),
      },
      token(),
    );
    setup().status = result.status;
    setup().step = 'done';
  });

A.setupReload = () =>
  withBusy(async () => {
    const status = await backend.setup.status();
    if (status.initialized) {
      S.ui.setup = null;
      S.ui.auth = 'login';
      S.ui.errors = {};
      render();
      return;
    }
    const next = setupState(status);
    next.message = setup().message;
    S.ui.setup = next;
  });

A.setupLogin = () => {
  S.ui.setup = null;
  S.ui.auth = 'login';
  S.ui.errors = {};
  render();
};

A.setupBack = () => {
  const st = setup();
  if (!st || st.busy) return;
  st.error = null;
  st.message = null;
  st.step = st.step === 3 ? 2 : 1;
  render();
};

A.setupDemo = async () => {
  S.ui.setup = null;
  try {
    await hydrate();
  } catch {
    /* keep the bundled seed document */
  }
  render();
};
