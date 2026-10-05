-- Dish Dash — database setup.
-- Paste this whole file into Supabase › SQL Editor › New query, and press Run.

create table if not exists games (
  pin         text primary key,
  round       int  not null default 1,
  phase       text not null default 'lobby',   -- lobby | question | reveal | final
  q           int  not null default 0,
  seconds     int  not null default 60,
  started_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists players (
  id         uuid primary key,
  pin        text not null references games(pin) on delete cascade,
  round      int  not null default 1,
  name       text not null,
  score      int  not null default 0,
  answers    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists players_pin_idx on players (pin);

-- Row level security. This is a classroom quiz with no logins, so anyone holding
-- the public anon key may read and write. Nothing private is stored: names and scores only.
alter table games   enable row level security;
alter table players enable row level security;

drop policy if exists games_read   on games;
drop policy if exists games_insert on games;
drop policy if exists games_update on games;
create policy games_read   on games for select using (true);
create policy games_insert on games for insert with check (true);
create policy games_update on games for update using (true);

drop policy if exists players_read   on players;
drop policy if exists players_insert on players;
drop policy if exists players_update on players;
create policy players_read   on players for select using (true);
create policy players_insert on players for insert with check (true);
create policy players_update on players for update using (true);

-- Live updates: push changes to every open screen.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;

-- Optional housekeeping. Run this now and then to clear out old games;
-- deleting a game deletes its players automatically.
-- delete from games where created_at < now() - interval '7 days';
