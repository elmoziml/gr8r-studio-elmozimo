const BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(method, path, body, setupToken) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (setupToken) headers['x-setup-token'] = setupToken;
  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    const error = new Error('Cannot reach the API server. Run npm run dev and keep the terminal open.');
    error.status = 0;
    error.cause = cause;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || response.statusText || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return payload.data ?? payload;
}

export const backend = {
  setup: {
    status: () => request('GET', '/setup/status'),
    testConnection: token => request('POST', '/setup/test-connection', {}, token),
    migrate: token => request('POST', '/setup/migrate', {}, token),
    install: (body, token) => request('POST', '/setup/install', body, token),
  },
  auth: {
    me: () => request('GET', '/auth/me'),
    login: body => request('POST', '/auth/login', body),
    signup: body => request('POST', '/auth/signup', body),
    logout: () => request('POST', '/auth/logout', {}),
    changePassword: body => request('POST', '/auth/password', body),
    sessions: () => request('GET', '/auth/sessions'),
    revokeSession: id => request('DELETE', `/auth/sessions/${encodeURIComponent(id)}`),
    revokeOtherSessions: () => request('DELETE', '/auth/sessions'),
  },
  bootstrap: () => request('GET', '/bootstrap'),
  saveWorkspace: document => request('PUT', '/workspace', document),
  activateWorkspace: id => request('POST', `/workspaces/${encodeURIComponent(id)}/activate`, {}),
  deleteWorkspace: id => request('DELETE', `/workspaces/${encodeURIComponent(id)}`),
};
