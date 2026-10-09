create table if not exists account_secrets (
  user_id text primary key,
  delete_pass_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists characters (
  id text primary key,
  user_id text not null,
  slot smallint not null check (slot >= 0 and slot < 6),
  name text not null,
  level integer not null default 1,
  xp integer not null default 0,
  vials integer not null default 0,
  unspent integer not null default 0,
  gold integer not null default 400,
  hp integer not null default 120,
  invested jsonb not null default '{}',
  bag jsonb not null default '[]',
  equipped jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

create index if not exists characters_user_idx on characters (user_id);
