import { getPool } from '../db/pool.js';
import { getAuthContext } from '../auth/session.js';

const epoch = value => (value == null ? null : new Date(value).getTime());
const dateOnly = value => {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const minutesSince = value => (value == null ? null : Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000)));

function sizeLabel(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`;
}

function sessionLabel(row) {
  if (row.is_current) return 'Active now';
  const minutes = minutesSince(row.last_seen_at);
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours ago`;
  return new Date(row.last_seen_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function preferenceDocument(prefs) {
  const language = String(prefs?.language || 'English (US)');
  return {
    theme: prefs?.theme || 'system',
    accent: prefs?.accent || 'indigo',
    side: prefs?.sidebar_density || 'comfortable',
    density: prefs?.density || 'comfortable',
    weekStart: prefs?.week_start ?? 1,
    dateFmt: prefs?.date_format || 'MMM d',
    lang: language.toLowerCase().startsWith('arabic') ? 'ar' : 'en',
    tz: prefs?.timezone || '(GMT-07:00) Pacific Time',
    motion: prefs?.motion || 'system',
    home: prefs?.home || 'home',
    openTasks: prefs?.open_tasks || 'drawer',
    name: prefs?.name || '',
    title: prefs?.title || '',
    defaultTab: prefs?.default_tab || 'board',
    confirmDel: prefs?.confirm_delete !== false,
    permCreate: prefs?.members_create_projects !== false,
    permGuests: prefs?.members_invite_guests !== false,
    permPublic: Boolean(prefs?.public_share_links),
    showDoneBoard: prefs?.show_done_board !== false,
    spellcheck: prefs?.spellcheck !== false,
    timeFormat: prefs?.time_format || '12',
  };
}

function viewDocument(rows) {
  const views = {};
  for (const row of rows) {
    views[row.view_key] = {
      filters: row.filters || [],
      sort: row.sort || { f: 'manual', dir: 1 },
      group: row.group || 'status',
      q: row.query || '',
      hidden: row.hidden_cols || [],
      colW: row.col_widths || {},
      showDone: row.show_done !== false,
      ...(row.mode ? { mode: row.mode } : {}),
    };
  }
  return views;
}

export async function registerBootstrapRoutes(fastify) {
  fastify.get('/api/bootstrap', async request => {
    const context = await getAuthContext(request);
    if (!context) {
      const error = new Error('Not authenticated');
      error.statusCode = 401;
      throw error;
    }
    if (!context.workspace || !context.member) {
      const error = new Error('No workspace membership found');
      error.statusCode = 403;
      throw error;
    }

    const workspaceId = context.workspace.id;
    const pool = getPool();
    const [teamsResult, membersResult, projectsResult, projectMembersResult, milestonesResult] = await Promise.all([
      pool.query('select * from teams where workspace_id = $1 order by name', [workspaceId]),
      pool.query('select * from members where workspace_id = $1 order by created_at', [workspaceId]),
      pool.query('select * from projects where workspace_id = $1 order by position, created_at', [workspaceId]),
      pool.query('select pm.* from project_members pm join projects p on p.id = pm.project_id where p.workspace_id = $1 order by pm.position', [workspaceId]),
      pool.query('select mi.* from milestones mi join projects p on p.id = mi.project_id where p.workspace_id = $1 order by mi.position', [workspaceId]),
    ]);

    const projectIds = projectsResult.rows
      .filter(
        project =>
          context.member.role === 'Owner' ||
          context.member.role === 'Admin' ||
          !project.private ||
          projectMembersResult.rows.some(item => item.project_id === project.id && item.member_id === context.member.id),
      )
      .map(project => project.id);

    const [
      tasksResult,
      taskLabelsResult,
      subtasksResult,
      dependenciesResult,
      commentsResult,
      reactionsResult,
      activityResult,
      notificationsResult,
      filesResult,
      eventsResult,
      savedViewsResult,
      recentSearchesResult,
      sessionsResult,
      invoicesResult,
      viewStatesResult,
    ] = await Promise.all([
      pool.query('select t.* from tasks t where t.project_id = any($1::uuid[]) order by t."order", t.created_at', [projectIds]),
      pool.query('select tl.* from task_labels tl join tasks t on t.id = tl.task_id where t.project_id = any($1::uuid[]) order by tl.position', [projectIds]),
      pool.query('select s.* from subtasks s join tasks t on t.id = s.task_id where t.project_id = any($1::uuid[]) order by s.position', [projectIds]),
      pool.query('select d.* from task_dependencies d join tasks t on t.id = d.task_id where t.project_id = any($1::uuid[]) order by d.position', [projectIds]),
      pool.query('select c.* from comments c join tasks t on t.id = c.task_id where t.project_id = any($1::uuid[]) order by c.created_at', [projectIds]),
      pool.query(
        'select r.* from comment_reactions r join comments c on c.id = r.comment_id join tasks t on t.id = c.task_id where t.project_id = any($1::uuid[])',
        [projectIds],
      ),
      pool.query('select * from activity where workspace_id = $1 and project_id = any($2::uuid[]) order by created_at desc limit 200', [
        workspaceId,
        projectIds,
      ]),
      pool.query('select * from notifications where workspace_id = $1 and project_id = any($2::uuid[]) order by created_at desc limit 100', [
        workspaceId,
        projectIds,
      ]),
      pool.query('select * from files where project_id = any($1::uuid[]) order by created_at desc', [projectIds]),
      pool.query('select * from events where project_id = any($1::uuid[]) order by date', [projectIds]),
      pool.query('select * from saved_views where project_id = any($1::uuid[]) order by created_at', [projectIds]),
      pool.query('select * from recent_searches where user_id = $1 and (workspace_id = $2 or workspace_id is null) order by position', [
        context.user.id,
        workspaceId,
      ]),
      pool.query('select * from sessions where user_id = $1 and revoked_at is null order by last_seen_at desc', [context.user.id]),
      pool.query('select * from invoices where workspace_id = $1 order by issued_on desc', [workspaceId]),
      pool.query('select * from user_view_states where user_id = $1', [context.user.id]),
    ]);

    const teams = teamsResult.rows.map(row => ({ id: row.id, name: row.name, icon: row.icon, c: row.color, desc: row.description }));
    const members = membersResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      team: row.team_id || '',
      title: row.title,
      c: row.avatar_color,
      status: row.status,
      last: minutesSince(row.last_seen_at),
      tz: row.timezone || '—',
    }));

    const projectMembers = new Map();
    for (const row of projectMembersResult.rows) {
      if (!projectIds.includes(row.project_id)) continue;
      if (!projectMembers.has(row.project_id)) projectMembers.set(row.project_id, []);
      projectMembers.get(row.project_id).push({ member: row.member_id, perm: row.perm });
    }
    const milestones = new Map();
    for (const row of milestonesResult.rows) {
      if (!projectIds.includes(row.project_id)) continue;
      if (!milestones.has(row.project_id)) milestones.set(row.project_id, []);
      milestones.get(row.project_id).push({ id: row.id, name: row.name, date: dateOnly(row.date) });
    }

    const projects = projectsResult.rows
      .filter(row => projectIds.includes(row.id))
      .map(row => {
        const linked = projectMembers.get(row.id) || [];
        const perms = {};
        for (const item of linked) perms[item.member] = item.perm;
        return {
          id: row.id,
          key: row.key,
          name: row.name,
          icon: row.icon,
          color: row.color,
          status: row.status,
          team: row.team_id || '',
          lead: row.lead_id || null,
          due: dateOnly(row.due),
          start: dateOnly(row.start),
          fav: row.fav,
          members: linked.map(item => item.member),
          perms,
          desc: row.description,
          milestones: milestones.get(row.id) || [],
          last: minutesSince(row.last_activity_at),
          private: row.private,
          access: row.access,
          archived: row.archived,
          archivedAt: epoch(row.archived_at),
          seq: row.seq,
        };
      });

    const labelsByTask = new Map();
    for (const row of taskLabelsResult.rows) {
      if (!labelsByTask.has(row.task_id)) labelsByTask.set(row.task_id, []);
      labelsByTask.get(row.task_id).push(row.label_id);
    }
    const subtasksByTask = new Map();
    for (const row of subtasksResult.rows) {
      if (!subtasksByTask.has(row.task_id)) subtasksByTask.set(row.task_id, []);
      subtasksByTask.get(row.task_id).push({
        id: row.id,
        title: row.title,
        done: row.done,
        note: row.note,
        assignee: row.assignee_id,
        due: dateOnly(row.due),
      });
    }
    const depsByTask = new Map();
    for (const row of dependenciesResult.rows) {
      if (!depsByTask.has(row.task_id)) depsByTask.set(row.task_id, []);
      depsByTask.get(row.task_id).push(row.depends_on_id);
    }

    const files = filesResult.rows.map(row => ({
      id: row.id,
      project: row.project_id,
      name: row.name,
      type: row.type,
      size: sizeLabel(row.size_bytes),
      by: row.uploader_id,
      at: epoch(row.created_at),
      task: row.task_id,
    }));
    const attachmentsByTask = new Map();
    for (const file of files) {
      if (!file.task) continue;
      if (!attachmentsByTask.has(file.task)) attachmentsByTask.set(file.task, []);
      attachmentsByTask.get(file.task).push(file);
    }

    const tasks = tasksResult.rows.map(row => ({
      id: row.id,
      key: row.key,
      project: row.project_id,
      title: row.title,
      status: row.status,
      assignee: row.assignee_id,
      priority: row.priority,
      due: dateOnly(row.due),
      start: dateOnly(row.start),
      labels: labelsByTask.get(row.id) || [],
      subtasks: subtasksByTask.get(row.id) || [],
      attachments: attachmentsByTask.get(row.id) || [],
      deps: depsByTask.get(row.id) || [],
      desc: row.description,
      estimate: row.estimate,
      created: epoch(row.created_at),
      updated: epoch(row.updated_at),
      order: Number(row.order),
      fav: row.fav,
      recur: row.repeat,
      archived: row.archived,
      archivedAt: epoch(row.archived_at),
      completedAt: epoch(row.completed_at),
      prevStatus: row.prev_status,
    }));

    const reactionsByComment = new Map();
    for (const row of reactionsResult.rows) {
      if (!reactionsByComment.has(row.comment_id)) reactionsByComment.set(row.comment_id, {});
      const map = reactionsByComment.get(row.comment_id);
      if (!map[row.emoji]) map[row.emoji] = [];
      map[row.emoji].push(row.member_id);
    }
    const comments = commentsResult.rows.map(row => ({
      id: row.id,
      task: row.task_id,
      by: row.member_id,
      at: epoch(row.created_at),
      text: row.text,
      re: reactionsByComment.get(row.id) || {},
    }));

    const activity = activityResult.rows.map(row => ({
      id: row.id,
      by: row.member_id,
      verb: row.verb,
      task: row.task_id,
      project: row.project_id,
      at: epoch(row.created_at),
      extra: row.extra,
    }));

    const notifs = notificationsResult.rows.map(row => ({
      id: row.id,
      type: row.type,
      by: row.actor_id,
      task: row.task_id,
      project: row.project_id,
      text: row.text,
      snippet: row.snippet,
      at: epoch(row.created_at),
      read: row.read,
    }));

    const events = eventsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      date: dateOnly(row.date),
      time: String(row.time).slice(0, 5),
      project: row.project_id,
    }));

    const savedViews = savedViewsResult.rows.map(row => ({
      id: row.id,
      project: row.project_id,
      name: row.name,
      type: row.type,
      filters: row.filters || [],
    }));

    const sessions = sessionsResult.rows.map(row => ({
      id: row.id,
      dev: row.device,
      loc: row.location || '—',
      at: sessionLabel(row),
      cur: row.is_current,
    }));

    const invoices = invoicesResult.rows.map(row => ({
      id: row.id,
      date: dateOnly(row.issued_on),
      amt: `$${(row.amount_cents / 100).toFixed(2)}`,
      st: row.status,
    }));

    const data = {
      ws: {
        id: context.workspace.id,
        name: context.workspace.name,
        url: context.workspace.url,
        c: context.workspace.color,
        brand: context.workspace.brand,
      },
      workspaces: context.memberships.map(row => ({
        id: row.workspace_id,
        name: row.workspace_name,
        url: row.workspace_url,
        c: row.workspace_color,
        plan: row.workspace_plan,
        brand: row.workspace_brand,
      })),
      me: context.member.id,
      members,
      teams,
      projects,
      tasks,
      comments,
      activity,
      notifs,
      files,
      events,
      projOrder: projects.map(project => project.id),
      savedViews,
      recentSearches: recentSearchesResult.rows.map(row => row.term),
      sessions,
      invoices,
      plan: context.workspace.plan,
      tfa: Boolean(context.prefs?.tfa_enabled),
      notifPrefs: context.prefs?.notif_prefs || {},
    };

    return {
      data: {
        data,
        prefs: preferenceDocument(context.prefs),
        views: viewDocument(viewStatesResult.rows),
        collapsed: Boolean(context.prefs?.sidebar_collapsed),
        revision: context.workspace.revision,
      },
    };
  });
}
