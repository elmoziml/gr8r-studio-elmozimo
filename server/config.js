import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || '.data');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

let fileConfigCache;

export function getFileConfig() {
  if (fileConfigCache !== undefined) return fileConfigCache;
  try {
    fileConfigCache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    fileConfigCache = null;
  }
  return fileConfigCache;
}

export function getDatabaseConfig() {
  const envUrl = String(process.env.DATABASE_URL || '').trim();
  return { url: envUrl || null, source: envUrl ? 'env' : 'none' };
}

export function getSessionSecret() {
  return String(process.env.SESSION_SECRET || getFileConfig()?.sessionSecret || '').trim() || null;
}

export function ensureSessionSecret() {
  if (getSessionSecret()) return getSessionSecret();
  const secret = crypto.randomBytes(48).toString('base64url');
  saveFileConfig({ sessionSecret: secret });
  return secret;
}

export function saveFileConfig(patch) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const next = {
    ...(getFileConfig() || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* best effort on filesystems without POSIX permissions */
  }
  fileConfigCache = next;
  return next;
}

export function redactDatabaseUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '***';
  }
}

export function ensureDataDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
