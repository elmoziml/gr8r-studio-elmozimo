import { randomUUID } from 'node:crypto';
import { seed } from '../../src/data/seed.js';
import { TEAMS_SEED } from '../../src/core/constants.js';

const now = Date.now();
const uuid = () => randomUUID();
const minutesAgo = minutes => (minutes == null ? null : new Date(now - Number(minutes) * 60000));
const epochDate = value => (value == null ? null : new Date(Number(value)));

function sizeBytes(value) {
  const match = String(value || '').match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return 0;
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Math.round(Number(match[1]) * units[match[2].toUpperCase()]);
}

function amountCents(value) {
  const amount = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function sessionDate(value) {
  if (!value || value === 'Active now') return new Date(now);
  const hours = String(value).match(/^(\d+)\s*hours? ago$/i);
  if (hours) return new Date(now - Number(hours[1]) * 3600000);
  const parsed = new Date(`${value} ${new Date(now).getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function insert(client, table, row) {
  const keys = Object.keys(row);
  const columns = keys.map(key => `"${key}"`).join(', ');
  const params = keys.map((_, index) => `$${index + 1}`).join(', ');
  await client.query(
    `insert into ${table} (${columns}) values (${params})`,
    keys.map(key => row[key]),
  );
}

export async function seedDemoData(client, { workspaceId, ownerUserId, ownerMemberId, teamIds }) {
  const data = seed();
  const memberMap = new Map([[data.me, ownerMemberId]]);
  const projectMap = new Map();
  const taskMap = new Map();
  const teams = teamIds || new Map();

  if (!teams.size) {
    for (const team of data.teams?.length ? data.teams : TEAMS_SEED) {
      const id = uuid();
      teams.set(team.id, id);
      await insert(client, 'teams', {
        id,
        workspace_id: workspaceId,
        name: team.name,
        icon: team.icon || 'users',
        color: team.c || '#23918A',
        description: team.desc || '',
      });
    }
  }

  for (const member of data.members) {
    if (member.id === data.me) continue;
    const id = uuid();
    memberMap.set(member.id, id);
    await insert(client, 'members', {
      id,
      workspace_id: workspaceId,
      user_id: null,
      name: member.name,
      email: member.email,
      role: member.role || 'Member',
      team_id: teams.get(member.team) || null,
      title: member.title || '',
      avatar_color: member.c || '#6B7280',
      status: member.status || 'active',
      timezone: member.tz || null,
      last_seen_at: minutesAgo(member.last),
    });
  }

  const projectOrder = data.projOrder || data.projects.map(project => project.id);
  const projectPosition = new Map(projectOrder.map((id, index) => [id, index]));

  for (const project of data.projects) {
    const id = uuid();
    projectMap.set(project.id, id);
    await insert(client, 'projects', {
      id,
      workspace_id: workspaceId,
      key: project.key,
      name: project.name,
      icon: project.icon || 'folder',
      color: project.color || 'indigo',
      status: project.status || 'planning',
      team_id: teams.get(project.team) || null,
      lead_id: memberMap.get(project.lead) || null,
      due: project.due || null,
      start: project.start || null,
      fav: Boolean(project.fav),
      description: project.desc || '',
      private: Boolean(project.private),
      access: project.access || 'workspace',
      archived: Boolean(project.archived),
      archived_at: epochDate(project.archivedAt),
      last_activity_at: minutesAgo(project.last),
      position: projectPosition.get(project.id) || 0,
      seq: project.seq || 200,
    });
  }

  for (const project of data.projects) {
    const projectId = projectMap.get(project.id);
    for (const [index, memberId] of (project.members || []).entries()) {
      const memberUuid = memberMap.get(memberId);
      if (!memberUuid) continue;
      await insert(client, 'project_members', {
        project_id: projectId,
        member_id: memberUuid,
        perm: project.perms?.[memberId] || 'Can edit',
        position: index,
      });
    }
    for (const [index, milestone] of (project.milestones || []).entries()) {
      await insert(client, 'milestones', {
        id: uuid(),
        project_id: projectId,
        name: milestone.name,
        date: milestone.date,
        position: index,
      });
    }
  }

  for (const task of data.tasks) {
    const id = uuid();
    taskMap.set(task.id, id);
    await insert(client, 'tasks', {
      id,
      project_id: projectMap.get(task.project),
      key: task.key,
      title: task.title,
      status: task.status || 'todo',
      assignee_id: memberMap.get(task.assignee) || null,
      priority: task.priority || 'none',
      due: task.due || null,
      start: task.start || null,
      description: task.desc || '',
      estimate: task.estimate || null,
      order: task.order || 0,
      fav: Boolean(task.fav),
      repeat: task.recur || null,
      archived: Boolean(task.archived),
      archived_at: epochDate(task.archivedAt),
      completed_at: epochDate(task.completedAt),
      prev_status: task.prevStatus || null,
      created_at: epochDate(task.created) || new Date(now),
      updated_at: epochDate(task.updated) || new Date(now),
    });
  }

  for (const task of data.tasks) {
    const taskId = taskMap.get(task.id);
    for (const [index, label] of (task.labels || []).entries()) {
      await insert(client, 'task_labels', { task_id: taskId, label_id: label, position: index });
    }
    for (const [index, subtask] of (task.subtasks || []).entries()) {
      await insert(client, 'subtasks', {
        id: uuid(),
        task_id: taskId,
        title: subtask.title,
        done: Boolean(subtask.done),
        note: subtask.note || null,
        assignee_id: memberMap.get(subtask.assignee) || null,
        due: subtask.due || null,
        position: index,
      });
    }
    for (const [index, dependency] of (task.deps || []).entries()) {
      const dependsOn = taskMap.get(dependency);
      if (!dependsOn || dependsOn === taskId) continue;
      await insert(client, 'task_dependencies', { task_id: taskId, depends_on_id: dependsOn, position: index });
    }
  }

  for (const comment of data.comments) {
    const id = uuid();
    await insert(client, 'comments', {
      id,
      task_id: taskMap.get(comment.task),
      member_id: memberMap.get(comment.by),
      text: comment.text,
      created_at: epochDate(comment.at) || new Date(now),
    });
    for (const [emoji, memberIds] of Object.entries(comment.re || {})) {
      for (const memberId of memberIds) {
        const memberUuid = memberMap.get(memberId);
        if (!memberUuid) continue;
        await insert(client, 'comment_reactions', { comment_id: id, member_id: memberUuid, emoji });
      }
    }
  }

  const taskProject = new Map(data.tasks.map(task => [task.id, task.project]));

  for (const entry of data.activity) {
    await insert(client, 'activity', {
      id: uuid(),
      workspace_id: workspaceId,
      member_id: memberMap.get(entry.by) || null,
      verb: entry.verb,
      task_id: taskMap.get(entry.task) || null,
      project_id: projectMap.get(entry.project || taskProject.get(entry.task)) || null,
      extra: entry.extra || '',
      created_at: epochDate(entry.at) || new Date(now),
    });
  }

  for (const notification of data.notifs) {
    await insert(client, 'notifications', {
      id: uuid(),
      workspace_id: workspaceId,
      type: notification.type,
      actor_id: memberMap.get(notification.by) || null,
      task_id: taskMap.get(notification.task) || null,
      project_id: projectMap.get(notification.project || taskProject.get(notification.task)) || null,
      text: notification.text,
      snippet: notification.snippet || '',
      read: Boolean(notification.read),
      created_at: epochDate(notification.at) || new Date(now),
    });
  }

  for (const file of data.files) {
    await insert(client, 'files', {
      id: uuid(),
      project_id: projectMap.get(file.project),
      task_id: taskMap.get(file.task) || null,
      name: file.name,
      type: file.type || 'other',
      size_bytes: sizeBytes(file.size),
      uploader_id: memberMap.get(file.by) || null,
      storage_path: null,
      created_at: epochDate(file.at) || new Date(now),
    });
  }

  for (const event of data.events) {
    await insert(client, 'events', {
      id: uuid(),
      project_id: projectMap.get(event.project),
      title: event.title,
      date: event.date,
      time: event.time,
    });
  }

  for (const view of data.savedViews || []) {
    await insert(client, 'saved_views', {
      id: uuid(),
      project_id: projectMap.get(view.project),
      name: view.name,
      type: view.type || 'list',
      filters: JSON.stringify(view.filters || []),
    });
  }

  for (const [index, term] of (data.recentSearches || []).entries()) {
    await insert(client, 'recent_searches', {
      id: uuid(),
      user_id: ownerUserId,
      workspace_id: workspaceId,
      term,
      position: index,
    });
  }

  for (const session of data.sessions || []) {
    await insert(client, 'sessions', {
      id: uuid(),
      user_id: ownerUserId,
      device: session.dev,
      location: session.loc || null,
      is_current: Boolean(session.cur),
      last_seen_at: sessionDate(session.at),
    });
  }

  for (const invoice of data.invoices || []) {
    await insert(client, 'invoices', {
      id: `${invoice.id}-${workspaceId.slice(0, 8)}`,
      workspace_id: workspaceId,
      issued_on: invoice.date,
      amount_cents: amountCents(invoice.amt),
      status: invoice.st || 'Paid',
    });
  }
}
