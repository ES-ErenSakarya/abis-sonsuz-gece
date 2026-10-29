create table if not exists stalls (
  character_id text primary key,
  user_id text not null,
  nick text not null,
  x double precision not null default 0,
  z double precision not null default 0,
  items jsonb not null default '[]',
  bank integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists stalls_user_idx on stalls (user_id);
