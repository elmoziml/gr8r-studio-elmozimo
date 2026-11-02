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
      and (
        m.role in ('Owner', 'Admin')
        or p.private = false
        or exists (
          select 1 from project_members pm
          where pm.project_id = p.id
            and pm.member_id = m.id
        )
      )
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
    select 1 from tasks t
    where t.id = task
      and app_can_project(t.project_id)
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
    select 1 from comments c
    where c.id = comment
      and app_can_task(c.task_id)
  );
$$;

drop policy if exists app_projects on projects;
create policy app_projects on projects for all using (app_can_project(id)) with check (app_can_project(id));

drop policy if exists app_activity on activity;
create policy app_activity on activity
  for all using (app_is_member(workspace_id) and (project_id is null or app_can_project(project_id)))
  with check (app_is_member(workspace_id) and (project_id is null or app_can_project(project_id)));

drop policy if exists app_notifications on notifications;
create policy app_notifications on notifications
  for all using (app_is_member(workspace_id) and (project_id is null or app_can_project(project_id)))
  with check (app_is_member(workspace_id) and (project_id is null or app_can_project(project_id)));
