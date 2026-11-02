import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { TEAMS_SEED } from '../../src/core/constants.js';
import { seedDemoData } from './demo-data.js';

const slug = value =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';

export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function uniqueWorkspaceUrl(client, requested, name) {
  const base = slug(requested || name || 'workspace');
  let candidate = base;
  let index = 2;
  while ((await client.query('select 1 from workspaces where url = $1', [candidate])).rowCount) {
    candidate = `${base}-${index++}`;
  }
  return candidate;
}

export async function createOwnerWorkspace(client, { admin, workspace, demoData }) {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const memberId = randomUUID();
  const workspaceName = String(workspace?.name || '').trim() || 'My Workspace';
  const url = await uniqueWorkspaceUrl(client, workspace?.url, workspaceName);
  const passwordHash = await hashPassword(admin.password);

  await client.query('insert into users (id, email, name, password_hash) values ($1, $2, $3, $4)', [userId, admin.email, admin.name, passwordHash]);
  await client.query('insert into workspaces (id, name, url, color, plan, brand) values ($1, $2, $3, $4, $5, $6)', [
    workspaceId,
    workspaceName,
    url,
    '#1D1C1A',
    'Free',
    false,
  ]);
  await client.query(
    'insert into members (id, workspace_id, user_id, name, email, role, title, avatar_color, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [memberId, workspaceId, userId, admin.name, admin.email, 'Owner', 'Owner', '#5A67D8', 'active'],
  );

  const teamIds = new Map();
  for (const team of TEAMS_SEED) {
    const id = randomUUID();
    teamIds.set(team.id, id);
    await client.query('insert into teams (id, workspace_id, name, icon, color, description) values ($1, $2, $3, $4, $5, $6)', [
      id,
      workspaceId,
      team.name,
      team.icon,
      team.c,
      team.desc,
    ]);
  }
  await client.query('update members set team_id = $1 where id = $2', [teamIds.get('product') || null, memberId]);

  await client.query(
    `insert into user_preferences (
      user_id, theme, accent, sidebar_density, density, week_start, date_format, language, timezone, motion,
      home, open_tasks, name, title, spellcheck, time_format, show_done_board, members_create_projects,
      members_invite_guests, public_share_links, confirm_delete, default_tab, sidebar_collapsed,
      active_workspace_id, tfa_enabled, notif_prefs
    ) values (
      $1, 'system', 'indigo', 'comfortable', 'comfortable', 1, 'MMM d', 'English (US)',
      '(GMT-07:00) Pacific Time', 'system', 'home', 'drawer', $2, $3, true, '12', true, true, true,
      false, true, 'board', false, $4, false, '{}'::jsonb
    )`,
    [userId, admin.name, 'Owner', workspaceId],
  );

  if (demoData) {
    await seedDemoData(client, {
      workspaceId,
      ownerUserId: userId,
      ownerMemberId: memberId,
      teamIds,
    });
  }

  return { userId, workspaceId, memberId, workspaceName, url };
}
