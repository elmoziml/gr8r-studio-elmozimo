alter table users add column if not exists password_hash text;
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists disabled_at timestamptz;

alter table sessions add column if not exists token_hash text;
alter table sessions add column if not exists expires_at timestamptz;
alter table sessions add column if not exists user_agent text;
alter table sessions add column if not exists ip text;
alter table sessions add column if not exists revoked_at timestamptz;

create unique index if not exists users_email_lower_idx on users (lower(email));
create unique index if not exists sessions_token_hash_idx on sessions (token_hash) where token_hash is not null;
create index if not exists sessions_user_expires_idx on sessions (user_id, expires_at desc);

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         member_role not null default 'Member',
  token_hash   text not null unique,
  invited_by   uuid references members(id) on delete set null,
  expires_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists invitations_workspace_email_idx on invitations (workspace_id, lower(email));
create index if not exists invitations_token_idx on invitations (token_hash);
