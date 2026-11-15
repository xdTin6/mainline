create table if not exists build_updates (
  id text primary key,
  project_id text not null references projects (id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists build_updates_project_idx
  on build_updates (project_id, created_at desc);
create index if not exists build_updates_user_idx
  on build_updates (user_id, created_at desc);

alter table notes
  add column if not exists parent_note_id text references notes (id) on delete cascade;

create index if not exists notes_parent_idx on notes (parent_note_id, created_at);

create table if not exists collab_posts (
  id text primary key,
  user_id text not null,
  project_id text references projects (id) on delete set null,
  title text not null,
  description text not null,
  skills text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collab_posts_status_idx
  on collab_posts (status, created_at desc);
create index if not exists collab_posts_user_idx on collab_posts (user_id);

create table if not exists collab_interests (
  id text primary key,
  post_id text not null references collab_posts (id) on delete cascade,
  user_id text not null,
  message text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists prompt_entries (
  id text primary key,
  prompt_key text not null,
  user_id text not null,
  project_id text references projects (id) on delete set null,
  body text not null,
  repo_url text not null default '',
  created_at timestamptz not null default now(),
  unique (prompt_key, user_id)
);

create index if not exists prompt_entries_week_idx
  on prompt_entries (prompt_key, created_at desc);

create table if not exists prompt_votes (
  entry_id text not null references prompt_entries (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  actor_id text,
  kind text not null,
  project_id text references projects (id) on delete set null,
  update_id text references build_updates (id) on delete set null,
  collab_post_id text references collab_posts (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);
