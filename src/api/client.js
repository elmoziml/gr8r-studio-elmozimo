import { API_CONFIG } from './config.js';
import { ApiError, handle } from './routes.js';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function parsePath(path) {
  const url = new URL(path, 'http://api.local');
  return { pathname: url.pathname, query: Object.fromEntries(url.searchParams.entries()) };
}

async function fetchTransport(method, pathname, query, body) {
  const url = new URL(pathname, API_CONFIG.baseUrl);
  for (const [key, value] of Object.entries(query)) if (value != null) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: body && Object.keys(body).length ? { 'Content-Type': 'application/json' } : undefined,
    body: body && Object.keys(body).length ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload.message || payload.error || response.statusText);
  return payload;
}

export async function request(method, path, options = {}) {
  const { pathname, query } = parsePath(path);
  const mergedQuery = { ...query, ...(options.query || {}) };
  const verb = String(method).toUpperCase();
  try {
    if (API_CONFIG.baseUrl) return await fetchTransport(verb, pathname, mergedQuery, options.body || {});
    if (API_CONFIG.latency > 0) await wait(API_CONFIG.latency);
    return await handle(verb, pathname, mergedQuery, options.body || {});
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error?.message || 'API request failed');
  }
}

const encode = value => encodeURIComponent(value);

function resource(path) {
  return {
    list: (query = {}) => request('GET', `/${path}`, { query }).then(response => response.data),
    get: id => request('GET', `/${path}/${encode(id)}`).then(response => response.data),
    create: body => request('POST', `/${path}`, { body }).then(response => response.data),
    update: (id, body) => request('PATCH', `/${path}/${encode(id)}`, { body }).then(response => response.data),
    remove: id => request('DELETE', `/${path}/${encode(id)}`).then(response => response.data),
  };
}

const RESOURCES = {
  workspaces: 'workspaces',
  teams: 'teams',
  members: 'members',
  projects: 'projects',
  tasks: 'tasks',
  comments: 'comments',
  activity: 'activity',
  notifications: 'notifications',
  files: 'files',
  events: 'events',
  savedViews: 'saved-views',
  sessions: 'sessions',
  invoices: 'invoices',
};

export const api = {
  request,
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  remove: path => request('DELETE', path),
  health: () => request('GET', '/health').then(response => response.data),
  bootstrap: () => request('GET', '/bootstrap').then(response => response.data),
  saveDocument: document => request('PUT', '/document', { body: document }),
  reset: keepPrefs => request('POST', '/reset', { body: { keepPrefs } }).then(response => response.data),
  vocabulary: () => request('GET', '/vocabulary').then(response => response.data),
  search: q => request('GET', '/search', { query: { q } }).then(response => response.data),
  workspace: {
    get: () => request('GET', '/workspace').then(response => response.data),
    update: body => request('PATCH', '/workspace', { body }).then(response => response.data),
  },
  me: () => request('GET', '/me').then(response => response.data),
  preferences: {
    get: () => request('GET', '/preferences').then(response => response.data),
    update: body => request('PATCH', '/preferences', { body }).then(response => response.data),
  },
  views: {
    list: () => request('GET', '/views').then(response => response.data),
    get: key => request('GET', `/views/${encode(key)}`).then(response => response.data),
    set: (key, body) => request('PUT', `/views/${encode(key)}`, { body }).then(response => response.data),
    remove: key => request('DELETE', `/views/${encode(key)}`).then(response => response.data),
  },
  recentSearches: {
    list: () => request('GET', '/recent-searches').then(response => response.data),
    add: term => request('POST', '/recent-searches', { body: { term } }).then(response => response.data),
    remove: term => request('DELETE', `/recent-searches/${encode(term)}`).then(response => response.data),
  },
  projectOrder: {
    get: () => request('GET', '/project-order').then(response => response.data),
    set: order => request('PUT', '/project-order', { body: { order } }).then(response => response.data),
  },
};

for (const [name, path] of Object.entries(RESOURCES)) api[name] = resource(path);

api.projects.tasks = id => request('GET', `/projects/${encode(id)}/tasks`).then(response => response.data);
api.projects.files = id => request('GET', `/projects/${encode(id)}/files`).then(response => response.data);
api.projects.events = id => request('GET', `/projects/${encode(id)}/events`).then(response => response.data);
api.projects.milestones = id => request('GET', `/projects/${encode(id)}/milestones`).then(response => response.data);
api.tasks.comments = id => request('GET', `/tasks/${encode(id)}/comments`).then(response => response.data);
api.tasks.subtasks = id => request('GET', `/tasks/${encode(id)}/subtasks`).then(response => response.data);
api.tasks.files = id => request('GET', `/tasks/${encode(id)}/files`).then(response => response.data);
api.members.tasks = id => request('GET', `/members/${encode(id)}/tasks`).then(response => response.data);
