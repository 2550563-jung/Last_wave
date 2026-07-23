create extension if not exists pgcrypto with schema extensions;

create table if not exists public.last_wave_verified_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  mode text not null check (mode in ('weekly')),
  seed_key text not null check (char_length(seed_key) between 8 and 32),
  token_hash text not null,
  started_at timestamptz not null default now(),
  last_checkpoint_at timestamptz,
  checkpoint_wave integer not null default 0 check (checkpoint_wave >= 0),
  checkpoint_score bigint not null default 0 check (checkpoint_score >= 0),
  checkpoint_kills integer not null default 0 check (checkpoint_kills >= 0),
  finished_at timestamptz,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists last_wave_verified_runs_player_started_idx
  on public.last_wave_verified_runs (player_id, started_at desc);

create index if not exists last_wave_verified_runs_seed_idx
  on public.last_wave_verified_runs (seed_key, accepted);

alter table public.last_wave_verified_runs enable row level security;
revoke all on public.last_wave_verified_runs from anon, authenticated;

create table if not exists public.last_wave_weekly_rankings (
  id bigint generated always as identity primary key,
  seed_key text not null,
  player_id uuid not null,
  nickname varchar(16) not null check (char_length(nickname) between 2 and 16),
  score bigint not null check (score >= 0),
  wave integer not null check (wave >= 1),
  kills integer not null check (kills >= 0),
  job varchar(32) not null,
  weapon varchar(32) not null,
  duration_ms bigint not null check (duration_ms >= 0),
  verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seed_key, player_id)
);

create index if not exists last_wave_weekly_rankings_board_idx
  on public.last_wave_weekly_rankings (seed_key, score desc, wave desc, kills desc);

alter table public.last_wave_weekly_rankings enable row level security;
revoke all on public.last_wave_weekly_rankings from anon, authenticated;

create or replace function public.lw_begin_verified_run_v1(
  p_player_id uuid,
  p_mode text,
  p_seed_key text,
  p_token text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_mode <> 'weekly'
     or char_length(coalesce(p_seed_key,'')) not between 8 and 32
     or char_length(coalesce(p_token,'')) < 48 then
    raise exception 'invalid verified run request';
  end if;

  if (
    select count(*)
    from public.last_wave_verified_runs
    where player_id=p_player_id
      and started_at > now()-interval '10 minutes'
      and finished_at is null
  ) >= 3 then
    raise exception 'too many active verified runs';
  end if;

  insert into public.last_wave_verified_runs(player_id,mode,seed_key,token_hash)
  values(p_player_id,p_mode,p_seed_key,encode(digest(p_token,'sha256'),'hex'))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.lw_checkpoint_verified_run_v1(
  p_run_id uuid,
  p_token text,
  p_wave integer,
  p_score bigint,
  p_kills integer
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run public.last_wave_verified_runs%rowtype;
  v_elapsed numeric;
begin
  select * into v_run
  from public.last_wave_verified_runs
  where id=p_run_id
  for update;

  if not found
     or v_run.finished_at is not null
     or v_run.token_hash<>encode(digest(coalesce(p_token,''),'sha256'),'hex') then
    raise exception 'invalid verified run token';
  end if;

  v_elapsed:=extract(epoch from (now()-v_run.started_at));
  if p_wave < v_run.checkpoint_wave
     or p_score < v_run.checkpoint_score
     or p_kills < v_run.checkpoint_kills
     or p_wave > 250
     or p_score > (v_elapsed*25000 + p_wave*15000)
     or p_kills > (v_elapsed*35 + 600) then
    update public.last_wave_verified_runs
    set finished_at=now(), accepted=false
    where id=p_run_id;
    return false;
  end if;

  update public.last_wave_verified_runs
  set last_checkpoint_at=now(),
      checkpoint_wave=p_wave,
      checkpoint_score=p_score,
      checkpoint_kills=p_kills
  where id=p_run_id;
  return true;
end;
$$;

create or replace function public.lw_finish_verified_run_v1(
  p_run_id uuid,
  p_token text,
  p_nickname text,
  p_score bigint,
  p_wave integer,
  p_kills integer,
  p_job text,
  p_weapon text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run public.last_wave_verified_runs%rowtype;
  v_elapsed numeric;
  v_duration_ms bigint;
  v_accepted boolean;
begin
  select * into v_run
  from public.last_wave_verified_runs
  where id=p_run_id
  for update;

  if not found
     or v_run.finished_at is not null
     or v_run.token_hash<>encode(digest(coalesce(p_token,''),'sha256'),'hex') then
    raise exception 'invalid verified run token';
  end if;

  v_elapsed:=extract(epoch from (now()-v_run.started_at));
  v_duration_ms:=floor(v_elapsed*1000);
  v_accepted:=
    char_length(coalesce(p_nickname,'')) between 2 and 16
    and p_wave between 1 and 250
    and p_score >= v_run.checkpoint_score
    and p_kills >= v_run.checkpoint_kills
    and p_score <= (v_elapsed*25000 + p_wave*15000)
    and p_kills <= (v_elapsed*35 + 600)
    and v_elapsed >= greatest(3,p_wave*2.5)
    and (
      v_elapsed < 70
      or v_run.last_checkpoint_at is not null
    );

  update public.last_wave_verified_runs
  set finished_at=now(), accepted=v_accepted
  where id=p_run_id;

  if not v_accepted then
    return false;
  end if;

  insert into public.last_wave_weekly_rankings(
    seed_key,player_id,nickname,score,wave,kills,job,weapon,duration_ms,verified
  ) values (
    v_run.seed_key,v_run.player_id,p_nickname,p_score,p_wave,p_kills,
    left(coalesce(p_job,'soldier'),32),left(coalesce(p_weapon,'pistol'),32),
    v_duration_ms,true
  )
  on conflict (seed_key,player_id) do update
  set nickname=excluded.nickname,
      score=excluded.score,
      wave=excluded.wave,
      kills=excluded.kills,
      job=excluded.job,
      weapon=excluded.weapon,
      duration_ms=excluded.duration_ms,
      verified=true,
      updated_at=now()
  where excluded.score > public.last_wave_weekly_rankings.score
     or (
       excluded.score=public.last_wave_weekly_rankings.score
       and excluded.wave>public.last_wave_weekly_rankings.wave
     );

  return true;
end;
$$;

create or replace function public.lw_list_weekly_rankings_v1(
  p_seed_key text,
  p_limit integer default 20
) returns table(
  nickname text,
  score bigint,
  wave integer,
  kills integer,
  job text,
  weapon text,
  duration_ms bigint,
  verified boolean
)
language sql
security definer
set search_path = public
as $$
  select r.nickname::text,r.score,r.wave,r.kills,r.job::text,r.weapon::text,r.duration_ms,r.verified
  from public.last_wave_weekly_rankings r
  where r.seed_key=p_seed_key and r.verified=true
  order by r.score desc,r.wave desc,r.kills desc,r.duration_ms asc
  limit least(greatest(coalesce(p_limit,20),1),100);
$$;

create or replace function public.lw_list_spectatable_rooms_v1()
returns table(
  room_code text,
  host_nickname text,
  player_count bigint,
  max_players integer,
  current_wave integer
)
language sql
security definer
set search_path = public
as $$
  select r.room_code::text,
         r.host_nickname::text,
         count(m.player_id)::bigint,
         r.max_players,
         null::integer
  from public.last_wave_rooms r
  left join public.last_wave_room_members m on m.room_code=r.room_code
  where r.is_public=true
    and r.status='playing'
    and r.updated_at>now()-interval '2 hours'
  group by r.room_code,r.host_nickname,r.max_players,r.updated_at
  order by r.updated_at desc
  limit 30;
$$;

revoke all on function public.lw_begin_verified_run_v1(uuid,text,text,text) from public;
revoke all on function public.lw_checkpoint_verified_run_v1(uuid,text,integer,bigint,integer) from public;
revoke all on function public.lw_finish_verified_run_v1(uuid,text,text,bigint,integer,integer,text,text) from public;
revoke all on function public.lw_list_weekly_rankings_v1(text,integer) from public;
revoke all on function public.lw_list_spectatable_rooms_v1() from public;

grant execute on function public.lw_begin_verified_run_v1(uuid,text,text,text) to anon, authenticated;
grant execute on function public.lw_checkpoint_verified_run_v1(uuid,text,integer,bigint,integer) to anon, authenticated;
grant execute on function public.lw_finish_verified_run_v1(uuid,text,text,bigint,integer,integer,text,text) to anon, authenticated;
grant execute on function public.lw_list_weekly_rankings_v1(text,integer) to anon, authenticated;
grant execute on function public.lw_list_spectatable_rooms_v1() to anon, authenticated;
