-- Berlin Simulator: initial schema.
-- Every table has row level security. Players are anonymous Supabase users
-- and can only ever see their own rows. NPC memory and rate limits are
-- written by the server (service role) only.

-- ---------------------------------------------------------------------------
-- profiles: one row per player
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_config jsonb not null,
  inventory jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Players read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Players create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Players update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- experiences: the Berlin album
-- ---------------------------------------------------------------------------
create table public.experiences (
  user_id uuid not null references auth.users (id) on delete cascade,
  experience_id text not null check (experience_id ~ '^[a-z0-9_]{1,60}$'),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);

alter table public.experiences enable row level security;

create policy "Players read their own experiences"
  on public.experiences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players unlock their own experiences"
  on public.experiences for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- npc_memories: what each NPC remembers about each player
-- Written by the chat route with the service role. Players may read theirs.
-- ---------------------------------------------------------------------------
create table public.npc_memories (
  user_id uuid not null references auth.users (id) on delete cascade,
  npc_id text not null check (npc_id ~ '^[a-z_]{1,40}$'),
  summary text not null default '' check (char_length(summary) <= 600),
  last_messages jsonb not null default '[]'::jsonb,
  turns integer not null default 0 check (turns >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, npc_id)
);

alter table public.npc_memories enable row level security;

create policy "Players read their own NPC memories"
  on public.npc_memories for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- rate_limits: chat messages per player per hour, plus a global daily counter
-- No policies: only the service role (which bypasses RLS) touches these.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, window_start)
);

alter table public.rate_limits enable row level security;

create table public.global_usage (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);

alter table public.global_usage enable row level security;

-- Counts one chat message if both the player's hourly limit and the global
-- daily limit allow it. Atomic: concurrent requests cannot overshoot.
create function public.consume_chat_quota(
  p_user uuid,
  p_user_limit integer,
  p_global_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour timestamptz := date_trunc('hour', now());
  v_day date := (now() at time zone 'utc')::date;
  v_user integer;
  v_global integer;
begin
  insert into public.global_usage (day, count) values (v_day, 0)
    on conflict (day) do nothing;
  select g.count into v_global from public.global_usage g where g.day = v_day for update;

  insert into public.rate_limits (user_id, window_start, count) values (p_user, v_hour, 0)
    on conflict (user_id, window_start) do nothing;
  select r.count into v_user from public.rate_limits r
    where r.user_id = p_user and r.window_start = v_hour for update;

  if v_global >= p_global_limit then
    return jsonb_build_object(
      'allowed', false, 'scope', 'global', 'remaining', greatest(0, p_user_limit - v_user));
  end if;
  if v_user >= p_user_limit then
    return jsonb_build_object('allowed', false, 'scope', 'user', 'remaining', 0);
  end if;

  update public.global_usage set count = count + 1 where day = v_day;
  update public.rate_limits set count = count + 1
    where user_id = p_user and window_start = v_hour;
  -- Old windows are of no further use.
  delete from public.rate_limits
    where user_id = p_user and window_start < v_hour - interval '1 day';

  return jsonb_build_object(
    'allowed', true, 'scope', null, 'remaining', p_user_limit - v_user - 1);
end;
$$;

revoke all on function public.consume_chat_quota(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_chat_quota(uuid, integer, integer) to service_role;
