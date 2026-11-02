import { randomUUID } from 'node:crypto';
import { LABELS } from '../../src/core/constants.js';
import { getAuthContext } from '../auth/session.js';
import { getPool } from '../db/pool.js';
import { setRlsContext } from '../db/rls.js';

const STATUS_IDS = new Set(['backlog', 'todo', 'progress', 'review', 'done']);
const PRIORITY_IDS = new Set(['urgent', 'high', 'medium', 'low', 'none']);
const PROJECT_STATUS_IDS = new Set(['planning', 'active', 'risk', 'hold', 'complete']);
const ROLE_IDS = new Set(['Owner', 'Admin', 'Member', 'Guest']);
const MEMBER_STATUS_IDS = new Set(['active', 'invited', 'deactivated']);
const ACCESS_IDS = new Set(['private', 'workspace']);
const PERM_IDS = new Set(['Can view', 'Can comment', 'Can edit', 'Full access']);
const FILE_TYPE_IDS = new Set(['fig', 'pdf', 'zip', 'img', 'sheet', 'doc', 'code', 'other']);
const NOTIF_TYPE_IDS = new Set(['mention', 'assign', 'comment', 'update']);
const REPEAT_IDS = new Set(['Daily', 'Weekly', 'Every 2 weeks', 'Monthly']);
const LABEL_IDS = new Set(LABELS.map(label => label.id));
const sameSet = (left, right) => left.size === right.size && [...left].every(value => right.has(value));
const normalizeTz = value => (!value || value === '—' ? '' : String(value));

const list = value => (Array.isArray(value) ? value : []);
const uniqueIds = values => [...new Set(values.filter(Boolean).map(String))];
const dateOnly = value => {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const timeStamp = value => (value == null ? null : new Date(Number(value)));
const minutesAgo = value => (value == null ? null : new Date(Date.now() - Number(value) * 60000));
const allowed = (set, value, fallback = null) => (set.has(value) ? value : fallback);

function sizeBytes(value) {
  const match = String(value || '').match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return 0;
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Math.round(Number(match[1]) * units[match[2].toUpperCase()]);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function savePreferences(client, { userId, workspaceId, prefs, data, collapsed }) {
  const language = prefs?.lang === 'ar' ? 'Arabic' : 'English (US)';
  await client.query(
    `insert into user_preferences (
      user_id, theme, accent, sidebar_density, density, week_start, date_format, language, timezone, motion,
      home, open_tasks, name, title, spellcheck, time_format, show_done_board, members_create_projects,
      members_invite_guests, public_share_links, confirm_delete, default_tab, sidebar_collapsed,
      tfa_enabled, notif_prefs, active_workspace_id
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26
    )
    on conflict (user_id) do update set
      theme = excluded.theme,
      accent = excluded.accent,
      sidebar_density = excluded.sidebar_density,
      density = excluded.density,
      week_start = excluded.week_start,
      date_format = excluded.date_format,
      language = excluded.language,
      timezone = excluded.timezone,
      motion = excluded.motion,
      home = excluded.home,
      open_tasks = excluded.open_tasks,
      name = excluded.name,
      title = excluded.title,
      spellcheck = excluded.spellcheck,
      time_format = excluded.time_format,
      show_done_board = excluded.show_done_board,
      members_create_projects = excluded.members_create_projects,
      members_invite_guests = excluded.members_invite_guests,
      public_share_links = excluded.public_share_links,
      confirm_delete = excluded.confirm_delete,
      default_tab = excluded.default_tab,
      sidebar_collapsed = excluded.sidebar_collapsed,
      tfa_enabled = excluded.tfa_enabled,
      notif_prefs = excluded.notif_prefs,
      updated_at = now()`,
    [
      userId,
      prefs?.theme || 'system',
      prefs?.accent || 'indigo',
      prefs?.side || 'comfortable',
      prefs?.density || 'comfortable',
      Number(prefs?.weekStart ?? 1),
      prefs?.dateFmt || 'MMM d',
      language,
      prefs?.tz || '(GMT-07:00) Pacific Time',
      prefs?.motion || 'system',
      prefs?.home || 'home',
      prefs?.openTasks || 'drawer',
      prefs?.name || '',
      prefs?.title || '',
      prefs?.spellcheck !== false,
      prefs?.timeFormat || '12',
      prefs?.showDoneBoard !== false,
      prefs?.permCreate !== false,
      prefs?.permGuests !== false,
      Boolean(prefs?.permPublic),
      prefs?.confirmDel !== false,
      prefs?.defaultTab || 'board',
      Boolean(collapsed),
      Boolean(data?.tfa),
      JSON.stringify(data?.notifPrefs || {}),
      workspaceId,
    ],
  );
}

async function saveViews(client, userId, views) {
  await client.query('delete from user_view_states where user_id = $1', [userId]);
  for (const [key, view] of Object.entries(views || {})) {
    if (!key || !view) continue;
    await client.query(
      `insert into user_view_states (user_id, view_key, filters, sort, "group", query, hidden_cols, col_widths, show_done, mode)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        key,
        JSON.stringify(view.filters || []),
        JSON.stringify(view.sort || { f: 'manual', dir: 1 }),
        view.group || 'status',
        view.q || '',
        JSON.stringify(view.hidden || []),
        JSON.stringify(view.colW || {}),
        view.showDone !== false,
        view.mode || null,
      ],
    );
  }
}

async function saveRecentSearches(client, userId, workspaceId, terms) {
  await client.query('delete from recent_searches where user_id = $1 and workspace_id = $2', [userId, workspaceId]);
  for (const [index, term] of list(terms).entries()) {
    const value = String(term || '').trim();
    if (!value) continue;
    await client.query('insert into recent_searches (id, user_id, workspace_id, term, position) values ($1, $2, $3, $4, $5)', [
      randomUUID(),
      userId,
      workspaceId,
      value,
      index,
    ]);
  }
}

export async function registerWorkspaceRoutes(fastify) {
  fastify.post('/api/workspaces/:id/activate', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const membership = context.memberships.find(item => item.workspace_id === request.params.id);
    if (!membership) throw httpError(403, 'You are not a member of this workspace');
    await getPool().query('update user_preferences set active_workspace_id = $2 where user_id = $1', [context.user.id, request.params.id]);
    return { data: { ok: true, workspaceId: request.params.id } };
  });

  fastify.delete('/api/workspaces/:id', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    const pool = getPool();
    const membership = await pool.query('select role from members where workspace_id = $1 and user_id = $2', [request.params.id, context.user.id]);
    if (!membership.rowCount) throw httpError(404, 'Workspace not found');
    if (!['Owner', 'Admin'].includes(membership.rows[0].role)) throw httpError(403, 'Only owners and admins can delete a workspace');
    const count = await pool.query('select count(*)::int as count from members where user_id = $1', [context.user.id]);
    if (count.rows[0].count <= 1) throw httpError(409, 'Create another workspace before deleting this one');

    await pool.query('delete from workspaces where id = $1', [request.params.id]);
    const next = await pool.query('select workspace_id from members where user_id = $1 order by created_at limit 1', [context.user.id]);
    const activeWorkspaceId = next.rows[0]?.workspace_id || null;
    await pool.query('update user_preferences set active_workspace_id = $2 where user_id = $1', [context.user.id, activeWorkspaceId]);
    return { data: { ok: true, activeWorkspaceId } };
  });
  fastify.put('/api/workspace', async request => {
    const context = await getAuthContext(request);
    if (!context) throw httpError(401, 'Not authenticated');
    if (!context.workspace || !context.member) throw httpError(403, 'No workspace membership found');
    if (context.member.role === 'Guest') throw httpError(403, 'Guests cannot modify the workspace');

    const body = request.body || {};
    const data = body.data || {};
    if (!data.ws || !Array.isArray(data.projects) || !Array.isArray(data.tasks)) {
      throw httpError(422, 'A complete workspace document is required');
    }

    const workspaceId = context.workspace.id;
    const userId = context.user.id;
    const currentMemberId = context.member.id;
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('begin');
      await setRlsContext(client, userId);
      const locked = await client.query('select * from workspaces where id = $1 for update', [workspaceId]);
      if (!locked.rowCount) throw httpError(404, 'Workspace not found');
      if (Number(locked.rows[0].revision) !== Number(body.revision)) throw httpError(409, 'Workspace changed on the server. Reload and try again.');

      const currentWorkspace = locked.rows[0];
      const [
        prefsResult,
        currentMembersResult,
        currentTeamsResult,
        currentProjectsResult,
        currentProjectMembersResult,
        currentTasksResult,
        currentCommentsResult,
        currentFilesResult,
        currentActivityResult,
      ] = await Promise.all([
        client.query('select * from user_preferences where user_id = $1', [userId]),
        client.query('select id, user_id, role, name, email, team_id, title, avatar_color, status, timezone from members where workspace_id = $1', [
          workspaceId,
        ]),
        client.query('select id, name, icon, color, description from teams where workspace_id = $1', [workspaceId]),
        client.query('select id, key, private, archived, access, lead_id from projects where workspace_id = $1', [workspaceId]),
        client.query('select pm.project_id, pm.member_id, pm.perm from project_members pm join projects p on p.id = pm.project_id where p.workspace_id = $1', [
          workspaceId,
        ]),
        client.query('select t.id, t.project_id from tasks t join projects p on p.id = t.project_id where p.workspace_id = $1', [workspaceId]),
        client.query(
          'select c.id, c.member_id, c.task_id, c.text from comments c join tasks t on t.id = c.task_id join projects p on p.id = t.project_id where p.workspace_id = $1',
          [workspaceId],
        ),
        client.query(
          'select f.id, f.uploader_id, f.project_id, f.task_id, f.name, f.type from files f join projects p on p.id = f.project_id where p.workspace_id = $1',
          [workspaceId],
        ),
        client.query('select id, member_id from activity where workspace_id = $1', [workspaceId]),
      ]);

      const currentMember = currentMembersResult.rows.find(row => row.id === currentMemberId);
      if (!currentMember) throw httpError(403, 'Your workspace membership was not found');
      const role = currentMember.role;
      const isOwner = role === 'Owner';
      const isAdmin = isOwner || role === 'Admin';
      const prefs = prefsResult.rows[0] || null;

      const currentMembers = new Map(currentMembersResult.rows.map(row => [row.id, row]));
      const currentTeams = new Map(currentTeamsResult.rows.map(row => [row.id, row]));
      const currentProjects = new Map(currentProjectsResult.rows.map(row => [row.id, row]));
      const projectMemberMap = new Map();
      for (const row of currentProjectMembersResult.rows) {
        if (!projectMemberMap.has(row.project_id)) projectMemberMap.set(row.project_id, new Map());
        projectMemberMap.get(row.project_id).set(row.member_id, row.perm);
      }
      const accessibleProjects = new Set(
        currentProjectsResult.rows
          .filter(project => isAdmin || !project.private || projectMemberMap.get(project.id)?.has(currentMemberId))
          .map(project => project.id),
      );
      const currentTasks = new Map(currentTasksResult.rows.map(row => [row.id, row]));
      const currentComments = new Map(currentCommentsResult.rows.map(row => [row.id, row]));
      const currentFiles = new Map(currentFilesResult.rows.map(row => [row.id, row]));
      const currentActivity = new Map(currentActivityResult.rows.map(row => [row.id, row]));

      const incomingMembers = list(data.members).filter(member => member?.id);
      const incomingMemberMap = new Map(incomingMembers.map(member => [member.id, member]));
      const incomingTeams = list(data.teams).filter(team => team?.id);
      const incomingProjects = list(data.projects).filter(project => project?.id);
      const incomingProjectMap = new Map(incomingProjects.map(project => [project.id, project]));
      const incomingTasks = list(data.tasks).filter(task => task?.id);
      const incomingComments = list(data.comments).filter(comment => comment?.id);
      const incomingCommentMap = new Map(incomingComments.map(comment => [comment.id, comment]));
      const incomingFiles = list(data.files).filter(file => file?.id);
      const incomingFileMap = new Map(incomingFiles.map(file => [file.id, file]));
      const incomingActivity = list(data.activity).filter(entry => entry?.id);

      if (!incomingMemberMap.has(currentMemberId)) throw httpError(403, 'You cannot remove yourself from the workspace');

      if (data.plan && data.plan !== currentWorkspace.plan && !isOwner) {
        throw httpError(403, 'Only owners can change the workspace plan');
      }
      if (!isAdmin) {
        const ws = data.ws || {};
        if (
          String(ws.name || '') !== currentWorkspace.name ||
          String(ws.url || '') !== currentWorkspace.url ||
          String(ws.c || '') !== currentWorkspace.color ||
          Boolean(ws.brand) !== currentWorkspace.brand
        ) {
          throw httpError(403, 'Members cannot change workspace settings');
        }
      }

      if (!isAdmin) {
        if (!sameSet(new Set(currentMembers.keys()), new Set(incomingMemberMap.keys()))) {
          throw httpError(403, 'Members cannot add or remove members');
        }
        for (const [id, incoming] of incomingMemberMap) {
          const current = currentMembers.get(id);
          if (!current) throw httpError(403, 'Members cannot add or remove members');
          if (id === currentMemberId) {
            if (
              incoming.role !== current.role ||
              String(incoming.name || '') !== current.name ||
              String(incoming.email || '') !== current.email ||
              String(incoming.team || '') !== String(current.team_id || '') ||
              incoming.status !== current.status
            ) {
              throw httpError(403, 'Members cannot change their role or identity');
            }
          } else if (
            incoming.role !== current.role ||
            String(incoming.name || '') !== current.name ||
            String(incoming.email || '') !== current.email ||
            String(incoming.team || '') !== String(current.team_id || '') ||
            incoming.status !== current.status ||
            String(incoming.c || '') !== current.avatar_color ||
            String(incoming.title || '') !== current.title ||
            normalizeTz(incoming.tz) !== normalizeTz(current.timezone)
          ) {
            throw httpError(403, 'Members cannot change other members');
          }
        }
      } else {
        if (![...incomingMemberMap.values()].some(member => member.role === 'Owner')) {
          throw httpError(403, 'At least one owner is required');
        }
        for (const current of currentMembers.values()) {
          if (current.role !== 'Owner') continue;
          const incoming = incomingMemberMap.get(current.id);
          if (!incoming || incoming.role !== 'Owner') throw httpError(403, 'Owner members cannot be removed or demoted');
        }
        if (!isOwner) {
          for (const [id, incoming] of incomingMemberMap) {
            const current = currentMembers.get(id);
            if (incoming.role === 'Owner' && (!current || current.role !== 'Owner')) {
              throw httpError(403, 'Only owners can assign the Owner role');
            }
          }
        }
      }

      if (!isAdmin) {
        const sameTeams =
          incomingTeams.length === currentTeams.size &&
          incomingTeams.every(team => {
            const current = currentTeams.get(team.id);
            return (
              current &&
              String(team.name || '') === current.name &&
              String(team.icon || '') === current.icon &&
              String(team.c || '') === current.color &&
              String(team.desc || '') === current.description
            );
          });
        if (!sameTeams) throw httpError(403, 'Members cannot change teams');
      }

      if (!isAdmin) {
        for (const id of currentProjects.keys()) {
          if (accessibleProjects.has(id) && !incomingProjectMap.has(id)) throw httpError(403, 'Members cannot delete projects');
        }
        for (const [id, incoming] of incomingProjectMap) {
          const current = currentProjects.get(id);
          if (current) {
            if (!accessibleProjects.has(id)) throw httpError(403, 'You do not have access to this project');
            if (
              Boolean(incoming.archived) !== current.archived ||
              Boolean(incoming.private) !== current.private ||
              String(incoming.access || 'workspace') !== current.access ||
              String(incoming.lead || '') !== String(current.lead_id || '') ||
              String(incoming.key || '') !== current.key
            ) {
              throw httpError(403, 'Members cannot change project access or ownership');
            }
            const currentMembersMap = projectMemberMap.get(id) || new Map();
            const incomingMembersSet = new Set(list(incoming.members).map(String));
            if (!sameSet(new Set(currentMembersMap.keys()), incomingMembersSet)) {
              throw httpError(403, 'Members cannot change project members');
            }
            const incomingPerms = incoming.perms || {};
            for (const [memberId, perm] of currentMembersMap) {
              if (String(incomingPerms[memberId] || 'Can edit') !== perm) throw httpError(403, 'Members cannot change project permissions');
            }
          } else {
            if (prefs && prefs.members_create_projects === false) throw httpError(403, 'Project creation is disabled');
            incoming.members = [...new Set([...list(incoming.members).map(String), currentMemberId])];
            incoming.perms = { ...(incoming.perms || {}), [currentMemberId]: 'Full access' };
          }
        }
      }

      if (!isAdmin) {
        for (const task of incomingTasks) {
          if (!accessibleProjects.has(String(task.project))) throw httpError(403, 'You do not have access to this project');
        }
        for (const event of list(data.events)) {
          if (!accessibleProjects.has(String(event.project))) throw httpError(403, 'You do not have access to this project');
        }
        for (const view of list(data.savedViews)) {
          if (!accessibleProjects.has(String(view.project))) throw httpError(403, 'You do not have access to this project');
        }
      }

      for (const comment of incomingComments) {
        const current = currentComments.get(comment.id);
        if (!current) {
          comment.by = currentMemberId;
        } else if (
          !isAdmin &&
          current.member_id !== currentMemberId &&
          (String(comment.text || '') !== current.text || String(comment.by || '') !== current.member_id)
        ) {
          throw httpError(403, 'You can only edit your own comments');
        }
      }
      if (!isAdmin) {
        for (const current of currentComments.values()) {
          const task = currentTasks.get(current.task_id);
          if (!task || !accessibleProjects.has(task.project_id)) continue;
          if (!incomingCommentMap.has(current.id) && current.member_id !== currentMemberId) {
            throw httpError(403, 'You can only delete your own comments');
          }
        }
      }

      for (const file of incomingFiles) {
        const current = currentFiles.get(file.id);
        if (!current) {
          file.by = currentMemberId;
          if (!accessibleProjects.has(String(file.project))) throw httpError(403, 'You do not have access to this project');
        } else if (!isAdmin && current.uploader_id !== currentMemberId) {
          if (
            String(file.name || '') !== current.name ||
            String(file.type || '') !== current.type ||
            String(file.project || '') !== current.project_id ||
            String(file.task || '') !== String(current.task_id || '')
          ) {
            throw httpError(403, 'You can only change files you uploaded');
          }
        }
      }
      if (!isAdmin) {
        for (const current of currentFiles.values()) {
          if (!accessibleProjects.has(current.project_id)) continue;
          if (!incomingFileMap.has(current.id) && current.uploader_id !== currentMemberId) {
            throw httpError(403, 'You can only delete files you uploaded');
          }
        }
      }

      for (const entry of incomingActivity) {
        const current = currentActivity.get(entry.id);
        if (!current) entry.by = currentMemberId;
        else if (!isAdmin && current.member_id !== currentMemberId) entry.by = current.member_id;
      }

      const writableProjectIds = [...new Set([...(isAdmin ? [...currentProjects.keys()] : [...accessibleProjects]), ...incomingProjectMap.keys()])];
      const ws = data.ws;
      await client.query('update workspaces set name = $2, url = $3, color = $4, brand = $5, plan = coalesce($6, plan) where id = $1', [
        workspaceId,
        String(ws.name || context.workspace.name),
        String(ws.url || context.workspace.url),
        String(ws.c || context.workspace.color || '#1D1C1A'),
        Boolean(ws.brand),
        data.plan ? allowed(new Set(['Free', 'Team', 'Business']), data.plan, null) : null,
      ]);

      await savePreferences(client, { userId, workspaceId, prefs: body.prefs || {}, data, collapsed: body.collapsed });
      await saveViews(client, userId, body.views || {});
      await saveRecentSearches(client, userId, workspaceId, data.recentSearches || []);

      const teams = list(data.teams).filter(team => team?.id);
      const teamIds = uniqueIds(teams.map(team => team.id));
      await client.query('delete from teams where workspace_id = $1 and not (id = any($2::uuid[]))', [workspaceId, teamIds]);
      for (const team of teams) {
        await client.query(
          `insert into teams (id, workspace_id, name, icon, color, description)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set name = excluded.name, icon = excluded.icon, color = excluded.color, description = excluded.description
           where teams.workspace_id = excluded.workspace_id`,
          [team.id, workspaceId, String(team.name || 'Team'), String(team.icon || 'users'), String(team.c || '#23918A'), String(team.desc || '')],
        );
      }

      const members = list(data.members).filter(member => member?.id);
      const memberIds = uniqueIds(members.map(member => member.id));
      for (const member of members) {
        await client.query(
          `insert into members (id, workspace_id, user_id, name, email, role, team_id, title, avatar_color, status, timezone, last_seen_at)
           values ($1, $2, null, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id) do update set
             name = excluded.name,
             email = excluded.email,
             role = excluded.role,
             team_id = excluded.team_id,
             title = excluded.title,
             avatar_color = excluded.avatar_color,
             status = excluded.status,
             timezone = excluded.timezone,
             last_seen_at = excluded.last_seen_at
           where members.workspace_id = excluded.workspace_id`,
          [
            member.id,
            workspaceId,
            String(member.name || 'Member'),
            String(member.email || ''),
            allowed(ROLE_IDS, member.role, 'Member'),
            teamIds.includes(String(member.team || '')) ? member.team : null,
            String(member.title || ''),
            String(member.c || '#6B7280'),
            allowed(MEMBER_STATUS_IDS, member.status, 'active'),
            member.tz && member.tz !== '—' ? String(member.tz) : null,
            minutesAgo(member.last),
          ],
        );
      }
      await client.query('delete from members where workspace_id = $1 and id <> $3 and not (id = any($2::uuid[]))', [workspaceId, memberIds, currentMemberId]);

      const projectOrder = list(data.projOrder);
      const positionById = new Map(projectOrder.map((id, index) => [String(id), index]));
      const projects = list(data.projects).filter(project => project?.id);
      const projectIds = uniqueIds(projects.map(project => project.id));
      await client.query('delete from projects where workspace_id = $1 and id = any($3::uuid[]) and not (id = any($2::uuid[]))', [
        workspaceId,
        projectIds,
        writableProjectIds,
      ]);
      for (const [index, project] of projects.entries()) {
        await client.query(
          `insert into projects (
            id, workspace_id, key, name, icon, color, status, team_id, lead_id, due, start, fav, description,
            private, access, archived, archived_at, last_activity_at, position, seq
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          on conflict (id) do update set
            key = excluded.key, name = excluded.name, icon = excluded.icon, color = excluded.color,
            status = excluded.status, team_id = excluded.team_id, lead_id = excluded.lead_id,
            due = excluded.due, start = excluded.start, fav = excluded.fav, description = excluded.description,
            private = excluded.private, access = excluded.access, archived = excluded.archived,
            archived_at = excluded.archived_at, last_activity_at = excluded.last_activity_at,
            position = excluded.position, seq = excluded.seq, updated_at = now()
          where projects.workspace_id = excluded.workspace_id`,
          [
            project.id,
            workspaceId,
            String(project.key || 'PRJ'),
            String(project.name || 'Untitled project'),
            String(project.icon || 'folder'),
            String(project.color || 'indigo'),
            allowed(PROJECT_STATUS_IDS, project.status, 'planning'),
            teamIds.includes(String(project.team || '')) ? project.team : null,
            memberIds.includes(String(project.lead || '')) ? project.lead : null,
            dateOnly(project.due),
            dateOnly(project.start),
            Boolean(project.fav),
            String(project.desc || ''),
            Boolean(project.private),
            allowed(ACCESS_IDS, project.access, 'workspace'),
            Boolean(project.archived),
            timeStamp(project.archivedAt),
            minutesAgo(project.last),
            Number.isFinite(positionById.get(String(project.id))) ? positionById.get(String(project.id)) : index,
            Number(project.seq || 200),
          ],
        );
      }

      await client.query('delete from project_members pm using projects p where pm.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])', [
        workspaceId,
        writableProjectIds,
      ]);
      await client.query('delete from milestones mi using projects p where mi.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])', [
        workspaceId,
        writableProjectIds,
      ]);
      for (const project of projects) {
        for (const [index, memberId] of list(project.members).entries()) {
          if (!memberIds.includes(String(memberId))) continue;
          await client.query('insert into project_members (project_id, member_id, perm, position) values ($1, $2, $3, $4) on conflict do nothing', [
            project.id,
            memberId,
            allowed(PERM_IDS, project.perms?.[memberId], 'Can edit'),
            index,
          ]);
        }
        for (const [index, milestone] of list(project.milestones).entries()) {
          await client.query('insert into milestones (id, project_id, name, date, position) values ($1, $2, $3, $4, $5)', [
            milestone.id && String(milestone.id).includes('-') ? milestone.id : randomUUID(),
            project.id,
            String(milestone.name || 'Milestone'),
            dateOnly(milestone.date),
            index,
          ]);
        }
      }

      const tasks = list(data.tasks).filter(task => task?.id && projectIds.includes(String(task.project)));
      const taskIds = uniqueIds(tasks.map(task => task.id));
      await client.query(
        'delete from tasks t using projects p where t.project_id = p.id and p.workspace_id = $1 and p.id = any($3::uuid[]) and not (t.id = any($2::uuid[]))',
        [workspaceId, taskIds, writableProjectIds],
      );
      for (const task of tasks) {
        await client.query(
          `insert into tasks (
            id, project_id, key, title, status, assignee_id, priority, due, start, description, estimate,
            "order", fav, repeat, archived, archived_at, completed_at, prev_status, created_at, updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          on conflict (id) do update set
            project_id = excluded.project_id, key = excluded.key, title = excluded.title, status = excluded.status,
            assignee_id = excluded.assignee_id, priority = excluded.priority, due = excluded.due, start = excluded.start,
            description = excluded.description, estimate = excluded.estimate, "order" = excluded."order",
            fav = excluded.fav, repeat = excluded.repeat, archived = excluded.archived, archived_at = excluded.archived_at,
            completed_at = excluded.completed_at, prev_status = excluded.prev_status, updated_at = excluded.updated_at
          where tasks.project_id in (select id from projects where workspace_id = $21)`,
          [
            task.id,
            task.project,
            String(task.key || 'TASK'),
            String(task.title || 'Untitled'),
            allowed(STATUS_IDS, task.status, 'todo'),
            memberIds.includes(String(task.assignee || '')) ? task.assignee : null,
            allowed(PRIORITY_IDS, task.priority, 'none'),
            dateOnly(task.due),
            dateOnly(task.start),
            String(task.desc || ''),
            task.estimate || null,
            Number(task.order || 0),
            Boolean(task.fav),
            allowed(REPEAT_IDS, task.recur, null),
            Boolean(task.archived),
            timeStamp(task.archivedAt),
            timeStamp(task.completedAt),
            allowed(STATUS_IDS, task.prevStatus, null),
            timeStamp(task.created) || new Date(),
            timeStamp(task.updated) || new Date(),
            workspaceId,
          ],
        );
      }

      await client.query(
        'delete from task_labels tl using tasks t, projects p where tl.task_id = t.id and t.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])',
        [workspaceId, writableProjectIds],
      );
      await client.query(
        'delete from subtasks s using tasks t, projects p where s.task_id = t.id and t.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])',
        [workspaceId, writableProjectIds],
      );
      await client.query(
        'delete from task_dependencies d using tasks t, projects p where d.task_id = t.id and t.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])',
        [workspaceId, writableProjectIds],
      );

      for (const task of tasks) {
        for (const [index, label] of list(task.labels).entries()) {
          if (!LABEL_IDS.has(label)) continue;
          await client.query('insert into task_labels (task_id, label_id, position) values ($1, $2, $3) on conflict do nothing', [task.id, label, index]);
        }
        for (const [index, subtask] of list(task.subtasks).entries()) {
          await client.query('insert into subtasks (id, task_id, title, done, note, assignee_id, due, position) values ($1,$2,$3,$4,$5,$6,$7,$8)', [
            subtask.id && String(subtask.id).includes('-') ? subtask.id : randomUUID(),
            task.id,
            String(subtask.title || 'Subtask'),
            Boolean(subtask.done),
            subtask.note || null,
            memberIds.includes(String(subtask.assignee || '')) ? subtask.assignee : null,
            dateOnly(subtask.due),
            index,
          ]);
        }
        for (const [index, dependency] of list(task.deps).entries()) {
          if (!taskIds.includes(String(dependency)) || dependency === task.id) continue;
          await client.query('insert into task_dependencies (task_id, depends_on_id, position) values ($1,$2,$3) on conflict do nothing', [
            task.id,
            dependency,
            index,
          ]);
        }
      }

      await client.query(
        'delete from comments c using tasks t, projects p where c.task_id = t.id and t.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])',
        [workspaceId, writableProjectIds],
      );
      for (const comment of list(data.comments)) {
        if (!taskIds.includes(String(comment.task)) || !memberIds.includes(String(comment.by))) continue;
        await client.query('insert into comments (id, task_id, member_id, text, created_at) values ($1,$2,$3,$4,$5)', [
          comment.id || randomUUID(),
          comment.task,
          comment.by,
          String(comment.text || ''),
          timeStamp(comment.at) || new Date(),
        ]);
        for (const [emoji, memberList] of Object.entries(comment.re || {})) {
          for (const memberId of list(memberList)) {
            if (!memberIds.includes(String(memberId))) continue;
            await client.query('insert into comment_reactions (comment_id, member_id, emoji) values ($1,$2,$3) on conflict do nothing', [
              comment.id,
              memberId,
              emoji,
            ]);
          }
        }
      }

      for (const entry of list(data.activity)) {
        if (!entry?.id) continue;
        await client.query(
          `insert into activity (id, workspace_id, member_id, verb, task_id, project_id, extra, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set verb = excluded.verb, task_id = excluded.task_id, project_id = excluded.project_id, extra = excluded.extra
           where activity.workspace_id = $9`,
          [
            entry.id,
            workspaceId,
            memberIds.includes(String(entry.by || '')) ? entry.by : null,
            String(entry.verb || 'updated'),
            taskIds.includes(String(entry.task || '')) ? entry.task : null,
            projectIds.includes(String(entry.project || '')) ? entry.project : null,
            String(entry.extra || ''),
            timeStamp(entry.at) || new Date(),
            workspaceId,
          ],
        );
      }

      for (const notification of list(data.notifs)) {
        if (!notification?.id) continue;
        await client.query(
          `insert into notifications (id, workspace_id, type, actor_id, task_id, project_id, text, snippet, read, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (id) do update set read = excluded.read, text = excluded.text, snippet = excluded.snippet
           where notifications.workspace_id = $11`,
          [
            notification.id,
            workspaceId,
            allowed(NOTIF_TYPE_IDS, notification.type, 'update'),
            memberIds.includes(String(notification.by || '')) ? notification.by : null,
            taskIds.includes(String(notification.task || '')) ? notification.task : null,
            projectIds.includes(String(notification.project || '')) ? notification.project : null,
            String(notification.text || ''),
            String(notification.snippet || ''),
            Boolean(notification.read),
            timeStamp(notification.at) || new Date(),
            workspaceId,
          ],
        );
      }

      const files = list(data.files).filter(file => file?.id && projectIds.includes(String(file.project)));
      const fileIds = uniqueIds(files.map(file => file.id));
      await client.query(
        'delete from files f using projects p where f.project_id = p.id and p.workspace_id = $1 and p.id = any($3::uuid[]) and not (f.id = any($2::uuid[]))',
        [workspaceId, fileIds, writableProjectIds],
      );
      for (const file of files) {
        await client.query(
          `insert into files (id, project_id, task_id, name, type, size_bytes, uploader_id, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do update set
             project_id = excluded.project_id, task_id = excluded.task_id, name = excluded.name,
             type = excluded.type, size_bytes = excluded.size_bytes, uploader_id = excluded.uploader_id, created_at = excluded.created_at
           where files.project_id in (select id from projects where workspace_id = $9)`,
          [
            file.id,
            file.project,
            taskIds.includes(String(file.task || '')) ? file.task : null,
            String(file.name || 'File'),
            allowed(FILE_TYPE_IDS, file.type, 'other'),
            sizeBytes(file.size),
            memberIds.includes(String(file.by || '')) ? file.by : null,
            timeStamp(file.at) || new Date(),
            workspaceId,
          ],
        );
      }

      await client.query('delete from events e using projects p where e.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])', [
        workspaceId,
        writableProjectIds,
      ]);
      for (const event of list(data.events)) {
        if (!projectIds.includes(String(event.project))) continue;
        await client.query('insert into events (id, project_id, title, date, time) values ($1,$2,$3,$4,$5)', [
          event.id || randomUUID(),
          event.project,
          String(event.title || 'Event'),
          dateOnly(event.date),
          String(event.time || '09:00'),
        ]);
      }

      await client.query('delete from saved_views v using projects p where v.project_id = p.id and p.workspace_id = $1 and p.id = any($2::uuid[])', [
        workspaceId,
        writableProjectIds,
      ]);
      for (const view of list(data.savedViews)) {
        if (!projectIds.includes(String(view.project))) continue;
        await client.query('insert into saved_views (id, project_id, name, type, filters) values ($1,$2,$3,$4,$5)', [
          view.id || randomUUID(),
          view.project,
          String(view.name || 'Saved view'),
          ['list', 'board', 'table'].includes(view.type) ? view.type : 'list',
          JSON.stringify(view.filters || []),
        ]);
      }

      const revision = await client.query('update workspaces set revision = revision + 1 where id = $1 returning revision', [workspaceId]);
      await client.query('commit');
      return { data: { ok: true, revision: Number(revision.rows[0].revision) } };
    } catch (error) {
      await client.query('rollback').catch(() => {});
      if (error.code === '23505') throw httpError(409, 'A unique value conflicts with existing data. Reload and try again.');
      throw error;
    } finally {
      client.release();
    }
  });
}
