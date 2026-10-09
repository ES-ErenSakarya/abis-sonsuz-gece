create table if not exists world_layout (
  id text primary key,
  poses jsonb not null,
  updated_at timestamptz not null default now()
);
