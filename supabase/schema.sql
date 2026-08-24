-- DWSKnockout schema — run in Supabase SQL Editor

-- ============ TABLES ============

create table if not exists public.teams (
  id          text primary key,              -- ESPN abbreviation, e.g. 'KC'
  name        text not null,
  display     text not null,
  color       text not null default '#333333',
  alt_color   text not null default '#999999',
  logo        text,
  wins        int not null default 0,
  losses      int not null default 0,
  ties        int not null default 0
);

create table if not exists public.games (
  id          text primary key,              -- ESPN event id
  season      int not null,
  week        int not null,
  kickoff     timestamptz not null,
  home_team   text not null references public.teams(id),
  away_team   text not null references public.teams(id),
  favorite    text references public.teams(id),
  spread      numeric(4,1),
  over_under  numeric(4,1),
  status      text not null default 'scheduled',  -- scheduled | in_progress | final
  home_score  int,
  away_score  int,
  winner      text references public.teams(id)    -- set when final
);

create table if not exists public.picks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  season     int not null,
  week       int not null,
  team       text not null references public.teams(id),
  game_id    text not null references public.games(id),
  result     text not null default 'pending',      -- pending | win | loss
  created_at timestamptz not null default now(),
  unique (user_id, season, week)
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null,
  is_admin       boolean not null default false,
  eliminated_week int,                            -- null = still alive
  created_at     timestamptz not null default now()
);

create index if not exists games_week_idx   on public.games (season, week);
create index if not exists picks_user_idx   on public.picks (user_id);
create index if not exists picks_week_idx   on public.picks (season, week);

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ POSTGREST GRANTS (required for projects created after May 2026) ============

grant usage on schema public to anon, authenticated, service_role;
grant select on public.teams, public.games to anon, authenticated;
grant select on public.profiles, public.picks to authenticated;
grant insert, update on public.picks to authenticated;
grant update on public.profiles to authenticated;
-- Server-side sync job (service_role) needs full table access
grant all on all tables in schema public to service_role;

-- ============ ROW LEVEL SECURITY ============

alter table public.teams    enable row level security;
alter table public.games    enable row level security;
alter table public.picks    enable row level security;
alter table public.profiles enable row level security;

-- Public league data readable by anyone (site is viewable pre-login)
drop policy if exists "public read teams" on public.teams;
create policy "public read teams"    on public.teams    for select using (true);
drop policy if exists "public read games" on public.games;
create policy "public read games"    on public.games    for select using (true);

-- Profiles visible to logged-in users
drop policy if exists "auth read profiles" on public.profiles;
create policy "auth read profiles"   on public.profiles for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"   on public.profiles for update to authenticated using (auth.uid() = id);

-- Picks: everyone logged-in sees all picks (standings need it),
-- but you may only create/change your own
drop policy if exists "auth read picks" on public.picks;
create policy "auth read picks"      on public.picks for select to authenticated using (true);
drop policy if exists "insert own pick" on public.picks;
create policy "insert own pick"      on public.picks for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "update own pick" on public.picks;
create policy "update own pick"      on public.picks for update to authenticated
  using (auth.uid() = user_id);

-- ============ PICK LOCK RULE (DB-level enforcement) ============
-- Picks are inserted/changed exclusively through make_pick() below,
-- which rejects picks after kickoff and blocks reused teams.

create or replace function public.make_pick(
  p_season int,
  p_week   int,
  p_team   text,
  p_game   text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_kickoff timestamptz;
begin
  select kickoff into v_kickoff from public.games where id = p_game;
  if v_kickoff is null then
    raise exception 'Game not found';
  end if;
  if v_kickoff <= now() then
    raise exception 'Picks are locked: this game already kicked off';
  end if;

  -- No reusing a team you already picked this season
  if exists (
    select 1 from public.picks
    where user_id = auth.uid() and season = p_season and team = p_team
  ) then
    raise exception 'You already used % this season', p_team;
  end if;

  insert into public.picks (user_id, season, week, team, game_id)
  values (auth.uid(), p_season, p_week, p_team, p_game)
  on conflict (user_id, season, week)
  do update set team = excluded.team, game_id = excluded.game_id;
end;
$$;
