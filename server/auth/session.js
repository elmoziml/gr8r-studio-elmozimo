import crypto from 'node:crypto';
import { getPool } from '../db/pool.js';

export const SESSION_COOKIE = 'gr8r_session';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function deviceLabel(userAgent = '') {
  const ua = String(userAgent);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Device';
  return `${os} · ${browser}`;
}

function cookieOptions(request) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https' || process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

export async function createSession(userId, request, reply) {
  const pool = getPool();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('update sessions set is_current = false where user_id = $1', [userId]);
  const result = await pool.query(
    `insert into sessions (user_id, device, location, is_current, last_seen_at, token_hash, expires_at, user_agent, ip)
     values ($1, $2, null, true, now(), $3, $4, $5, $6)
     returning *`,
    [userId, deviceLabel(request.headers['user-agent']), tokenHash, expiresAt, request.headers['user-agent'] || null, request.ip || null],
  );
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(request));
  return result.rows[0];
}

export async function readSession(request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const pool = getPool();
  const result = await pool.query(
    `select s.*, u.email, u.name as user_name, u.disabled_at
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
       and u.disabled_at is null
     limit 1`,
    [hashToken(token)],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    token,
    session: {
      id: row.id,
      userId: row.user_id,
      device: row.device,
      location: row.location,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
    },
    user: { id: row.user_id, email: row.email, name: row.user_name },
  };
}

export async function touchSession(sessionId) {
  await getPool().query('update sessions set last_seen_at = now() where id = $1', [sessionId]);
}

export async function revokeSession(sessionId) {
  await getPool().query('update sessions set revoked_at = now(), is_current = false where id = $1', [sessionId]);
}

export function clearSessionCookie(reply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

async function loadContext(auth) {
  const pool = getPool();
  const [prefsResult, membershipsResult] = await Promise.all([
    pool.query('select * from user_preferences where user_id = $1', [auth.user.id]),
    pool.query(
      `select m.*, w.name as workspace_name, w.url as workspace_url, w.color as workspace_color,
              w.plan as workspace_plan, w.brand as workspace_brand, w.revision as workspace_revision
       from members m
       join workspaces w on w.id = m.workspace_id
       where m.user_id = $1
       order by m.created_at`,
      [auth.user.id],
    ),
  ]);
  if (!membershipsResult.rowCount) return { ...auth, prefs: prefsResult.rows[0] || null, memberships: [], member: null, workspace: null };
  const prefs = prefsResult.rows[0] || null;
  const memberships = membershipsResult.rows;
  const member = memberships.find(row => row.workspace_id === prefs?.active_workspace_id) || memberships[0];
  return {
    ...auth,
    prefs,
    memberships,
    member,
    workspace: {
      id: member.workspace_id,
      name: member.workspace_name,
      url: member.workspace_url,
      color: member.workspace_color,
      plan: member.workspace_plan,
      brand: member.workspace_brand,
      revision: Number(member.workspace_revision || 0),
    },
  };
}

export async function getAuthContext(request) {
  const auth = await readSession(request);
  if (!auth) return null;
  return loadContext(auth);
}

export async function getUserContext(user, session = null) {
  return loadContext({ user, session });
}
