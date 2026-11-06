import argon2 from 'argon2';
import { getPool } from '../db/pool.js';
import { hashPassword } from '../db/create-workspace.js';
import { clearSessionCookie, createSession, getAuthContext, getUserContext, readSession, revokeSession, touchSession } from '../auth/session.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePassword(password) {
  if (String(password || '').length < 10 || !/[0-9\W]/.test(String(password))) {
    throw httpError(422, 'Password must be at least 10 characters and include a number or symbol');
  }
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) throw httpError(429, 'Too many attempts. Try again later.');
}

function clearRateLimit(key) {
  attempts.delete(key);
}

async function authPayload(context) {
  if (!context?.member) return { user: context?.user || null, member: null, workspace: null };
  const member = context.member;
  const workspace = context.workspace;
  return {
    user: context.user,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      workspaceId: member.workspace_id,
    },
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          url: workspace.url,
          color: workspace.color,
          plan: workspace.plan,
        }
      : null,
  };
}

export async function registerAuthRoutes(fastify) {
  fastify.post('/api/auth/login', async (request, reply) => {
    const email = String(request.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(request.body?.password || '');
    if (!EMAIL_RE.test(email) || !password) throw httpError(422, 'Email and password are required');

    const key = `${request.ip}:${email}`;
    checkRateLimit(key);

    const result = await getPool().query('select id, email, name, password_hash, disabled_at from users where lower(email) = $1 limit 1', [email]);
    const user = result.rows[0];
    if (!user?.password_hash || user.disabled_at) throw httpError(401, 'Invalid email or password');
    const valid = await argon2.verify(user.password_hash, password).catch(() => false);
    if (!valid) throw httpError(401, 'Invalid email or password');

    clearRateLimit(key);
    await createSession(user.id, request, reply);
    const context = await getUserContext({ id: user.id, email: user.email, name: user.name });
    return { data: await authPayload(context) };
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    const auth = await readSession(request);
    if (auth) await revokeSession(auth.session.id);
    clearSessionCookie(reply);
    return { data: { ok: true } };
  });

  fastify.get('/api/auth/me', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    await touchSession(context.session.id);
    return { data: await authPayload(context) };
  });

  fastify.post('/api/auth/password', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const currentPassword = String(request.body?.currentPassword || '');
    const newPassword = String(request.body?.newPassword || '');
    if (!currentPassword) throw httpError(422, 'Current password is required');
    validatePassword(newPassword);
    const result = await getPool().query('select password_hash from users where id = $1', [context.user.id]);
    const hash = result.rows[0]?.password_hash;
    if (!hash) throw httpError(400, 'This account has no password set');
    const valid = await argon2.verify(hash, currentPassword).catch(() => false);
    if (!valid) throw httpError(401, 'Current password is incorrect');
    const nextHash = await hashPassword(newPassword);
    await getPool().query('update users set password_hash = $2 where id = $1', [context.user.id, nextHash]);
    await getPool().query('update sessions set revoked_at = now(), is_current = false where user_id = $1 and id <> $2', [context.user.id, context.session.id]);
    return { data: { ok: true } };
  });

  fastify.delete('/api/auth/sessions', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const result = await getPool().query(
      'update sessions set revoked_at = now(), is_current = false where user_id = $1 and id <> $2 and revoked_at is null returning id',
      [context.user.id, context.session.id],
    );
    return { data: { ok: true, revoked: result.rowCount } };
  });

  fastify.get('/api/auth/sessions', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const result = await getPool().query(
      'select id, device, location, is_current, last_seen_at, created_at from sessions where user_id = $1 and revoked_at is null order by last_seen_at desc',
      [context.user.id],
    );
    return {
      data: result.rows.map(row => ({
        id: row.id,
        device: row.device,
        location: row.location,
        current: row.is_current,
        lastSeenAt: row.last_seen_at,
        createdAt: row.created_at,
      })),
    };
  });

  fastify.delete('/api/auth/sessions/:id', async (request, reply) => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const result = await getPool().query('update sessions set revoked_at = now(), is_current = false where id = $1 and user_id = $2 returning id', [
      request.params.id,
      context.user.id,
    ]);
    if (!result.rowCount) throw httpError(404, 'Session not found');
    if (request.params.id === context.session.id) clearSessionCookie(reply);
    return { data: { ok: true } };
  });
}
