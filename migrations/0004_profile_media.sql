alter table profiles
  add column if not exists avatar_image text not null default '',
  add column if not exists banner_image text not null default '',
  add column if not exists github_handle text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists x_handle text not null default '',
  add column if not exists bluesky_handle text not null default '';
