import { seed } from '../../data/seed.js';
import { API_CONFIG } from '../config.js';

const clone = value => JSON.parse(JSON.stringify(value));
const isDocument = value => Boolean(value && value.data && Array.isArray(value.data.tasks));

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep the document in memory */
  }
}

function makeDocument(source) {
  return {
    version: 1,
    data: source?.data || seed(),
    prefs: source?.prefs || {},
    views: source?.views || {},
    collapsed: Boolean(source?.collapsed),
    meta: { revision: Number(source?.meta?.revision) || 1, updatedAt: Date.now() },
  };
}

export function createFileRepository() {
  let cache = null;

  function loadSync() {
    if (cache) return cache;
    const current = read(API_CONFIG.storageKey);
    if (isDocument(current)) {
      cache = makeDocument(current);
      return cache;
    }
    const legacy = read(API_CONFIG.legacyStorageKey);
    cache = makeDocument(isDocument(legacy) ? legacy : null);
    write(API_CONFIG.storageKey, cache);
    return cache;
  }

  async function load() {
    return loadSync();
  }

  async function save(document) {
    const revision = (cache?.meta?.revision || 0) + 1;
    cache = { ...makeDocument(document), meta: { revision, updatedAt: Date.now() } };
    write(API_CONFIG.storageKey, cache);
    return clone(cache.meta);
  }

  async function reset(patch = {}) {
    cache = { ...makeDocument({}), ...patch, meta: { revision: 1, updatedAt: Date.now() } };
    write(API_CONFIG.storageKey, cache);
    return cache;
  }

  return { kind: 'file', loadSync, load, save, reset };
}
