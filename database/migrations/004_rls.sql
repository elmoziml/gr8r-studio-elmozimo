do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gr8r_app') then
    execute 'create role gr8r_app nologin';
  end if;
  execute format('grant gr8r_app to %I', current_user);
end $$;

grant usage on schema public to gr8r_app;
grant select, insert, update, delete on all tables in schema public to gr8r_app;
grant usage, select on all sequences in schema public to gr8r_app;

create or replace function app_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app_is_member(workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from members
    where members.workspace_id = workspace
      and members.user_id = app_user_id()
  );
$$;

create or replace function app_can_project(project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    join members m on m.workspace_id = p.workspace_id
    where p.id = project
      and m.user_id = app_user_id()
  );
$$;

create or replace function app_can_task(task uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tasks t
    join projects p on p.id = t.project_id
    join members m on m.workspace_id = p.workspace_id
    where t.id = task
      and m.user_id = app_user_id()
  );
$$;

create or replace function app_can_comment(comment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from comments c
    join tasks t on t.id = c.task_id
    join projects p on p.id = t.project_id
    join members m on m.workspace_id = p.workspace_id
    where c.id = comment
      and m.user_id = app_user_id()
  );
$$;

revoke execute on function app_user_id() from public;
revoke execute on function app_is_member(uuid) from public;
revoke execute on function app_can_project(uuid) from public;
revoke execute on function app_can_task(uuid) from public;
revoke execute on function app_can_comment(uuid) from public;
grant execute on function app_user_id() to gr8r_app;
grant execute on function app_is_member(uuid) to gr8r_app;
grant execute on function app_can_project(uuid) to gr8r_app;
grant execute on function app_can_task(uuid) to gr8r_app;
grant execute on function app_can_comment(uuid) to gr8r_app;

alter table users enable row level security;
alter table workspaces enable row level security;
alter table teams enable row level security;
alter table members enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table task_labels enable row level security;
alter table subtasks enable row level security;
alter table task_dependencies enable row level security;
alter table comments enable row level security;
alter table comment_reactions enable row level security;
alter table activity enable row level security;
alter table notifications enable row level security;
alter table files enable row level security;
alter table events enable row level security;
alter table saved_views enable row level security;
alter table user_preferences enable row level security;
alter table user_view_states enable row level security;
alter table recent_searches enable row level security;
alter table sessions enable row level security;
alter table invoices enable row level security;

drop policy if exists app_users on users;
create policy app_users on users for all using (id = app_user_id()) with check (id = app_user_id());

drop policy if exists app_workspaces on workspaces;
create policy app_workspaces on workspaces for all using (app_is_member(id)) with check (app_is_member(id));

drop policy if exists app_teams on teams;
create policy app_teams on teams for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));

drop policy if exists app_members on members;
create policy app_members on members for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));

drop policy if exists app_projects on projects;
create policy app_projects on projects for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));

drop policy if exists app_project_members on project_members;
create policy app_project_members on project_members for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_milestones on milestones;
create policy app_milestones on milestones for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_tasks on tasks;
create policy app_tasks on tasks for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_task_labels on task_labels;
create policy app_task_labels on task_labels for all using (app_can_task(task_id)) with check (app_can_task(task_id));

drop policy if exists app_subtasks on subtasks;
create policy app_subtasks on subtasks for all using (app_can_task(task_id)) with check (app_can_task(task_id));

drop policy if exists app_task_dependencies on task_dependencies;
create policy app_task_dependencies on task_dependencies
  for all using (app_can_task(task_id) and app_can_task(depends_on_id))
  with check (app_can_task(task_id) and app_can_task(depends_on_id));

drop policy if exists app_comments on comments;
create policy app_comments on comments for all using (app_can_task(task_id)) with check (app_can_task(task_id));

drop policy if exists app_comment_reactions on comment_reactions;
create policy app_comment_reactions on comment_reactions
  for all using (app_can_comment(comment_id))
  with check (app_can_comment(comment_id));

drop policy if exists app_activity on activity;
create policy app_activity on activity for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));

drop policy if exists app_notifications on notifications;
create policy app_notifications on notifications for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));

drop policy if exists app_files on files;
create policy app_files on files for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_events on events;
create policy app_events on events for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_saved_views on saved_views;
create policy app_saved_views on saved_views for all using (app_can_project(project_id)) with check (app_can_project(project_id));

drop policy if exists app_user_preferences on user_preferences;
create policy app_user_preferences on user_preferences for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists app_user_view_states on user_view_states;
create policy app_user_view_states on user_view_states for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists app_recent_searches on recent_searches;
create policy app_recent_searches on recent_searches for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists app_sessions on sessions;
create policy app_sessions on sessions for all using (user_id = app_user_id()) with check (user_id = app_user_id());

drop policy if exists app_invoices on invoices;
create policy app_invoices on invoices for all using (app_is_member(workspace_id)) with check (app_is_member(workspace_id));
