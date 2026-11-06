import { randomUUID } from 'node:crypto';
import { getAuthContext } from '../auth/session.js';
import { getPool } from '../db/pool.js';
import { hashPassword } from '../db/create-workspace.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ROLES = new Set(['Owner', 'Admin', 'Member', 'Guest']);

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function deriveName(email) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function validatePassword(password) {
  if (String(password || '').length < 10 || !/[0-9\W]/.test(String(password))) {
    throw httpError(422, 'Password must be at least 10 characters and include a number or symbol');
  }
}

async function memberPayload(client, memberId, existingAccount) {
  const result = await client.query(
    'select id, user_id, name, email, role, team_id, title, avatar_color, status, timezone from members where id = $1',
    [memberId],
  );
  const row = result.rows[0];
  return {
    existingUser: existingAccount,
    member: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      team: row.team_id || '',
      title: row.title,
      c: row.avatar_color,
      status: row.status,
      last: null,
      tz: row.timezone || '—',
    },
  };
}

export async function registerMemberRoutes(fastify) {
  fastify.post('/api/workspace/members', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    if (!context.workspace || !context.member) throw httpError(403, 'No workspace membership found');

    const actorRole = context.member.role;
    if (!['Owner', 'Admin'].includes(actorRole)) throw httpError(403, 'Only owners and admins can add members');

    const body = request.body || {};
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const role = String(body.role || 'Member');
    const team = String(body.team || '').trim() || null;

    if (!EMAIL_RE.test(email)) throw httpError(422, 'A valid email is required');
    if (!ROLES.has(role)) throw httpError(422, 'Invalid role');
    if (role === 'Owner' && actorRole !== 'Owner') throw httpError(403, 'Only owners can assign the Owner role');

    const workspaceId = context.workspace.id;
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('begin');

      if (team) {
        const teamResult = await client.query('select 1 from teams where id = $1 and workspace_id = $2', [team, workspaceId]);
        if (!teamResult.rowCount) throw httpError(422, 'Team not found in this workspace');
      }

      const userResult = await client.query('select id, name, disabled_at from users where lower(email) = $1 limit 1', [email]);
      const existingUser = userResult.rows[0] || null;
      if (existingUser?.disabled_at) throw httpError(409, 'This account is disabled');

      const memberResult = await client.query('select id, user_id from members where workspace_id = $1 and lower(email) = $2 limit 1', [
        workspaceId,
        email,
      ]);
      const existingMember = memberResult.rows[0] || null;
      if (existingMember?.user_id) throw httpError(409, 'This person is already a member of the workspace');

      let userId;
      let memberId;
      let memberName = name;

      if (existingUser) {
        userId = existingUser.id;
        memberName = name || existingUser.name || deriveName(email);
      } else {
        validatePassword(password);
        userId = randomUUID();
        memberName = name || deriveName(email);
        const passwordHash = await hashPassword(password);
        await client.query('insert into users (id, email, name, password_hash) values ($1, $2, $3, $4)', [
          userId,
          email,
          memberName,
          passwordHash,
        ]);
      }

      if (existingMember) {
        memberId = existingMember.id;
        await client.query(
          `update members
             set user_id = $2, name = $3, email = $4, role = $5, team_id = $6, title = $7, status = 'active'
           where id = $1`,
          [memberId, userId, memberName, email, role, team, role],
        );
      } else {
        memberId = randomUUID();
        await client.query(
          `insert into members (id, workspace_id, user_id, name, email, role, team_id, title, avatar_color, status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, '#6B7280', 'active')`,
          [memberId, workspaceId, userId, memberName, email, role, team, role],
        );
      }

      await client.query(
        `insert into user_preferences (user_id, name, title, active_workspace_id)
         values ($1, $2, $3, $4)
         on conflict (user_id) do nothing`,
        [userId, memberName, role, workspaceId],
      );

      const payload = await memberPayload(client, memberId, Boolean(existingUser));
      await client.query('commit');
      return { data: payload };
    } catch (error) {
      await client.query('rollback').catch(() => {});
      if (error.code === '23505') throw httpError(409, 'This person is already a member of the workspace');
      throw error;
    } finally {
      client.release();
    }
  });
}
