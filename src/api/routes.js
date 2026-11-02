import { LABELS, PRIOS, PSTAT, STATUSES, TEAMS_SEED } from '../core/constants.js';
import { repository } from './repository/index.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const clone = value => JSON.parse(JSON.stringify(value));
const makeId = prefix => prefix + Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const RESERVED_QUERY = new Set(['q', 'sort', 'order', 'limit', 'offset']);
const ok = (data, meta = {}) => ({ data, meta });

function ensureTeams(doc) {
  if (!Array.isArray(doc.data.teams)) doc.data.teams = TEAMS_SEED.map(team => ({ ...team }));
  return doc.data.teams;
}

const COLLECTIONS = {
  workspaces: { prefix: 'w', items: doc => doc.data.workspaces },
  teams: { prefix: 'tm', items: doc => ensureTeams(doc) },
  members: { prefix: 'm', items: doc => doc.data.members },
  projects: { prefix: 'p', items: doc => doc.data.projects },
  tasks: { prefix: 't', items: doc => doc.data.tasks },
  comments: { prefix: 'c', items: doc => doc.data.comments },
  activity: { prefix: 'a', items: doc => doc.data.activity },
  notifications: { prefix: 'n', items: doc => doc.data.notifs },
  files: { prefix: 'f', items: doc => doc.data.files },
  events: { prefix: 'e', items: doc => doc.data.events },
  'saved-views': { prefix: 'v', items: doc => doc.data.savedViews },
  sessions: { prefix: 'se', items: doc => doc.data.sessions },
  invoices: { prefix: 'inv', items: doc => doc.data.invoices },
};

const DEFAULTS = {
  tasks: (doc, body) => {
    const project = doc.data.projects.find(item => item.id === body.project) || doc.data.projects[0];
    const seq = (project?.seq || 200) + 1;
    if (project) project.seq = seq;
    const order = Math.max(0, ...doc.data.tasks.map(item => Number(item.order) || 0)) + 1;
    return {
      id: makeId('t'),
      key: project ? `${project.key}-${seq}` : undefined,
      project: project?.id,
      title: 'Untitled',
      status: 'todo',
      assignee: null,
      priority: 'none',
      due: null,
      start: null,
      labels: [],
      subtasks: [],
      attachments: [],
      deps: [],
      desc: '',
      estimate: null,
      created: now(),
      updated: now(),
      order,
      fav: false,
      recur: null,
    };
  },
  projects: doc => ({
    id: makeId('p'),
    key: 'PRJ',
    name: 'Untitled project',
    icon: 'folder',
    color: 'indigo',
    status: 'planning',
    team: null,
    lead: null,
    due: null,
    start: null,
    fav: false,
    members: [],
    desc: '',
    milestones: [],
    last: 0,
    private: false,
    seq: 200,
    position: doc.data.projOrder.length,
  }),
  members: () => ({
    id: makeId('m'),
    name: 'New member',
    email: '',
    role: 'Member',
    team: null,
    title: '',
    c: '#6B7280',
    status: 'invited',
    last: null,
    tz: null,
  }),
  comments: () => ({ id: makeId('c'), by: null, at: now(), text: '', re: {} }),
  files: () => ({ id: makeId('f'), name: 'Untitled', type: 'other', size: '0 KB', by: null, at: now(), task: null }),
  events: () => ({ id: makeId('e'), title: 'Untitled event', date: new Date().toISOString().slice(0, 10), time: '09:00' }),
  'saved-views': () => ({ id: makeId('v'), name: 'Saved view', type: 'list', filters: [] }),
};

const AFTER_CREATE = {
  projects: (doc, item) => {
    if (!doc.data.projOrder.includes(item.id)) doc.data.projOrder.push(item.id);
  },
};

const AFTER_DELETE = {
  projects: (doc, item) => {
    doc.data.projOrder = doc.data.projOrder.filter(id => id !== item.id);
  },
};

function matches(item, query) {
  return Object.entries(query).every(([key, value]) => {
    if (RESERVED_QUERY.has(key)) return true;
    const current = item[key];
    if (current == null) return false;
    if (Array.isArray(current)) return current.map(String).includes(String(value));
    return String(current) === String(value);
  });
}

function includesTerm(item, term) {
  return JSON.stringify(item ?? '')
    .toLowerCase()
    .includes(term);
}

function sortItems(items, field, order) {
  if (!field) return items;
  const direction = order === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return (left > right ? 1 : left < right ? -1 : 0) * direction;
  });
}

function paginate(items, query) {
  const offset = Math.max(0, Number(query.offset) || 0);
  const limit = query.limit == null ? items.length : Math.max(0, Number(query.limit) || 0);
  return items.slice(offset, offset + limit);
}

function endpointNotFound() {
  return new ApiError(404, 'Endpoint not found');
}

async function collectionRoute(method, name, id, query, body) {
  const definition = COLLECTIONS[name];
  const doc = await repository.load();
  const items = definition.items(doc);
  const idField = definition.idField || 'id';

  if (method === 'GET' && !id) {
    const term = String(query.q || '')
      .trim()
      .toLowerCase();
    const filtered = items.filter(item => matches(item, query)).filter(item => !term || includesTerm(item, term));
    const sorted = sortItems(filtered, query.sort, query.order);
    return ok(clone(paginate(sorted, query)), { total: filtered.length, collection: name });
  }

  if (method === 'GET' && id) {
    const item = items.find(entry => String(entry[idField]) === id);
    if (!item) throw new ApiError(404, `${name} not found`);
    return ok(clone(item));
  }

  if (method === 'POST' && !id) {
    const defaultItem = DEFAULTS[name]?.(doc, body) || {};
    const item = { ...defaultItem, ...clone(body) };
    if (!item[idField]) item[idField] = makeId(definition.prefix);
    items.push(item);
    AFTER_CREATE[name]?.(doc, item);
    await repository.save(doc);
    return ok(clone(item), { created: true });
  }

  if ((method === 'PATCH' || method === 'PUT') && id) {
    const index = items.findIndex(entry => String(entry[idField]) === id);
    if (index === -1) throw new ApiError(404, `${name} not found`);
    items[index] = { ...items[index], ...clone(body), [idField]: items[index][idField] };
    await repository.save(doc);
    return ok(clone(items[index]), { updated: true });
  }

  if (method === 'DELETE' && id) {
    const index = items.findIndex(entry => String(entry[idField]) === id);
    if (index === -1) throw new ApiError(404, `${name} not found`);
    const [item] = items.splice(index, 1);
    AFTER_DELETE[name]?.(doc, item);
    await repository.save(doc);
    return ok(clone(item), { deleted: true });
  }

  throw new ApiError(405, `${method} is not allowed on /${name}`);
}

function nestedRoute(method, root, id, child, query) {
  if (method !== 'GET') return null;
  return (async () => {
    const doc = await repository.load();
    if (root === 'projects') {
      const project = doc.data.projects.find(item => item.id === id);
      if (!project) throw new ApiError(404, 'project not found');
      if (child === 'tasks')
        return ok(clone(doc.data.tasks.filter(item => item.project === id)), { total: doc.data.tasks.filter(item => item.project === id).length });
      if (child === 'files')
        return ok(clone(doc.data.files.filter(item => item.project === id)), { total: doc.data.files.filter(item => item.project === id).length });
      if (child === 'events')
        return ok(clone(doc.data.events.filter(item => item.project === id)), { total: doc.data.events.filter(item => item.project === id).length });
      if (child === 'milestones') return ok(clone(project.milestones || []), { total: (project.milestones || []).length });
    }
    if (root === 'tasks') {
      const task = doc.data.tasks.find(item => item.id === id);
      if (!task) throw new ApiError(404, 'task not found');
      if (child === 'comments') {
        const items = doc.data.comments.filter(item => item.task === id);
        return ok(clone(items), { total: items.length });
      }
      if (child === 'subtasks') return ok(clone(task.subtasks || []), { total: (task.subtasks || []).length });
      if (child === 'files') {
        const items = doc.data.files.filter(item => item.task === id);
        return ok(clone(items), { total: items.length });
      }
    }
    if (root === 'members' && child === 'tasks') {
      const member = doc.data.members.find(item => item.id === id);
      if (!member) throw new ApiError(404, 'member not found');
      const items = doc.data.tasks.filter(item => item.assignee === id);
      return ok(clone(items), { total: items.length, q: query.q || '' });
    }
    throw endpointNotFound();
  })();
}

async function searchRoute(query) {
  const term = String(query.q || '')
    .trim()
    .toLowerCase();
  const doc = await repository.load();
  if (!term) return ok({ members: [], projects: [], tasks: [], files: [], events: [] }, { total: 0, q: term });
  const result = {
    members: doc.data.members.filter(item => includesTerm([item.name, item.email, item.title], term)),
    projects: doc.data.projects.filter(item => includesTerm([item.name, item.key, item.desc], term)),
    tasks: doc.data.tasks.filter(item => includesTerm([item.title, item.key, item.desc], term)),
    files: doc.data.files.filter(item => includesTerm([item.name, item.type], term)),
    events: doc.data.events.filter(item => includesTerm([item.title, item.project], term)),
  };
  const total = Object.values(result).reduce((sum, items) => sum + items.length, 0);
  return ok(clone(result), { total, q: term });
}

async function viewsRoute(method, key, body) {
  const doc = await repository.load();
  if (method === 'GET' && !key) return ok(clone(doc.views));
  if (method === 'GET') {
    if (!doc.views[key]) throw new ApiError(404, 'view not found');
    return ok(clone(doc.views[key]));
  }
  if (method === 'PUT' || method === 'PATCH') {
    if (!key) throw new ApiError(422, 'A view key is required');
    doc.views[key] = clone(body);
    await repository.save(doc);
    return ok(clone(doc.views[key]), { updated: true });
  }
  if (method === 'DELETE' && key) {
    const view = doc.views[key];
    if (!view) throw new ApiError(404, 'view not found');
    delete doc.views[key];
    await repository.save(doc);
    return ok(clone(view), { deleted: true });
  }
  throw new ApiError(405, `${method} is not allowed on /views`);
}

async function recentSearchesRoute(method, term, body) {
  const doc = await repository.load();
  const searches = doc.data.recentSearches || [];
  if (method === 'GET' && !term) return ok(clone(searches), { total: searches.length });
  if (method === 'POST' && !term) {
    const value = String(body.term || '').trim();
    if (!value) throw new ApiError(422, 'A search term is required');
    doc.data.recentSearches = [value, ...searches.filter(item => item !== value)].slice(0, 5);
    await repository.save(doc);
    return ok(clone(doc.data.recentSearches), { created: true });
  }
  if (method === 'DELETE' && term) {
    doc.data.recentSearches = searches.filter(item => item !== term);
    await repository.save(doc);
    return ok(clone(doc.data.recentSearches), { deleted: true });
  }
  throw new ApiError(405, `${method} is not allowed on /recent-searches`);
}

export async function handle(method, pathname, query = {}, body = {}) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [root, id, child] = parts;
  if (!root) throw endpointNotFound();

  if (root === 'health' && method === 'GET') {
    return ok({ status: 'ok', mode: repository.kind }, { time: new Date().toISOString() });
  }

  if (root === 'bootstrap' && method === 'GET') {
    const doc = await repository.load();
    return ok(
      { data: clone(doc.data), prefs: clone(doc.prefs), views: clone(doc.views), collapsed: Boolean(doc.collapsed) },
      { mode: repository.kind, revision: doc.meta?.revision, updatedAt: doc.meta?.updatedAt },
    );
  }

  if (root === 'document' && method === 'PUT') {
    if (!body?.data) throw new ApiError(422, 'A document with data is required');
    const meta = await repository.save(body);
    return ok({ saved: true }, meta);
  }

  if (root === 'reset' && method === 'POST') {
    const doc = await repository.reset(body?.keepPrefs ? { prefs: clone(body.prefs || {}) } : {});
    return ok({ data: clone(doc.data), prefs: clone(doc.prefs), views: clone(doc.views), collapsed: Boolean(doc.collapsed) }, { reset: true });
  }

  if (root === 'vocabulary' && method === 'GET') {
    return ok(clone({ statuses: STATUSES, priorities: PRIOS, labels: LABELS, projectStatuses: PSTAT, teams: TEAMS_SEED }));
  }

  if (root === 'workspace') {
    const doc = await repository.load();
    if (method === 'GET') return ok(clone(doc.data.ws));
    if (method === 'PATCH' || method === 'PUT') {
      const previousName = doc.data.ws.name;
      Object.assign(doc.data.ws, clone(body));
      const workspace = doc.data.workspaces.find(item => item.name === previousName);
      if (workspace) {
        if (body.name != null) workspace.name = body.name;
        if (body.url != null) workspace.url = body.url;
        if (body.c != null) workspace.c = body.c;
        if (body.brand != null) workspace.brand = body.brand;
      }
      await repository.save(doc);
      return ok(clone(doc.data.ws), { updated: true });
    }
    throw new ApiError(405, `${method} is not allowed on /workspace`);
  }

  if (root === 'me' && method === 'GET') {
    const doc = await repository.load();
    const member = doc.data.members.find(item => item.id === doc.data.me);
    if (!member) throw new ApiError(404, 'current member not found');
    return ok(clone(member));
  }

  if (root === 'preferences') {
    const doc = await repository.load();
    if (method === 'GET') return ok(clone(doc.prefs));
    if (method === 'PATCH' || method === 'PUT') {
      doc.prefs = { ...doc.prefs, ...clone(body) };
      await repository.save(doc);
      return ok(clone(doc.prefs), { updated: true });
    }
    throw new ApiError(405, `${method} is not allowed on /preferences`);
  }

  if (root === 'views') return viewsRoute(method, id, body);

  if (root === 'recent-searches') return recentSearchesRoute(method, id, body);

  if (root === 'project-order') {
    const doc = await repository.load();
    if (method === 'GET') return ok(clone(doc.data.projOrder));
    if (method === 'PUT') {
      if (!Array.isArray(body.order)) throw new ApiError(422, 'order must be an array');
      doc.data.projOrder = clone(body.order);
      await repository.save(doc);
      return ok(clone(doc.data.projOrder), { updated: true });
    }
    throw new ApiError(405, `${method} is not allowed on /project-order`);
  }

  if (root === 'search' && method === 'GET') return searchRoute(query);

  if (id && child) {
    const nested = await nestedRoute(method, root, id, child, query);
    if (nested) return nested;
  }

  if (COLLECTIONS[root]) return collectionRoute(method, root, id, query, body);

  throw endpointNotFound();
}
