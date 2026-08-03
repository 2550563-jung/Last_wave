-- Last Wave v108: authenticate Cloudflare room sockets and add verified seasons.

create or replace function public.lw_validate_realtime_connection_v1(
  p_room_code text,
  p_player_id uuid default null,
  p_session_token text default '',
  p_spectator boolean default false
)
returns table(valid boolean, spectator boolean, is_host boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(left(trim(coalesce(p_room_code,'')),6));
begin
  if clean_code !~ '^[A-Z0-9]{6}$' then
    return query select false,false,false;
    return;
  end if;

  if p_spectator then
    return query
      select exists(
        select 1 from public.last_wave_rooms room
        where room.room_code=clean_code
          and room.is_public=true
          and room.status='playing'
          and room.updated_at>now()-interval '3 minutes'
      ),true,false;
    return;
  end if;

  if p_player_id is null or char_length(p_session_token)<32 then
    return query select false,false,false;
    return;
  end if;

  return query
    select
      exists(
        select 1
        from public.last_wave_room_members member
        join public.last_wave_rooms room on room.room_code=member.room_code
        where member.room_code=clean_code
          and member.player_id=p_player_id
          and member.session_token_hash=public.lw_token_hash(p_session_token)
          and member.last_seen>now()-interval '30 minutes'
          and room.status in ('waiting','playing')
      ),
      false,
      exists(
        select 1 from public.last_wave_rooms room
        where room.room_code=clean_code and room.host_player_id=p_player_id
      );
end
$$;

revoke all on function public.lw_validate_realtime_connection_v1(text,uuid,text,boolean) from public;
grant execute on function public.lw_validate_realtime_connection_v1(text,uuid,text,boolean) to anon,authenticated;

create table if not exists public.last_wave_season_rankings (
  season_key text not null check (season_key ~ '^[0-9]{4}-S[1-4]$'),
  player_id uuid not null,
  nickname text not null,
  score bigint not null default 0 check (score>=0),
  wave integer not null default 1 check (wave>=1),
  kills integer not null default 0 check (kills>=0),
  job text not null,
  weapon text not null,
  verified_runs integer not null default 1 check (verified_runs>=1),
  updated_at timestamptz not null default now(),
  primary key (season_key,player_id)
);

create index if not exists last_wave_season_rankings_board_idx
  on public.last_wave_season_rankings (season_key,score desc,wave desc,kills desc);

alter table public.last_wave_season_rankings enable row level security;
revoke all on table public.last_wave_season_rankings from anon,authenticated;

create or replace function public.lw_list_season_rankings_v1(
  p_season_key text,
  p_limit integer default 20
)
returns table(nickname text,score bigint,wave integer,kills integer,job text,weapon text,verified_runs integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.nickname,r.score,r.wave,r.kills,r.job,r.weapon,r.verified_runs
  from public.last_wave_season_rankings r
  where r.season_key=p_season_key
  order by r.score desc,r.wave desc,r.kills desc
  limit greatest(1,least(100,p_limit))
$$;

revoke all on function public.lw_list_season_rankings_v1(text,integer) from public;
grant execute on function public.lw_list_season_rankings_v1(text,integer) to anon,authenticated;

create or replace function public.lw_refresh_season_ranking_v1(p_player_id uuid,p_seed_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.last_wave_weekly_rankings%rowtype;
  source_year integer;
  source_week integer;
  season_number integer;
  key text;
begin
  select * into source_row from public.last_wave_weekly_rankings
  where player_id=p_player_id and seed_key=p_seed_key and verified=true;
  if not found then return false; end if;

  source_year:=substring(p_seed_key from '([0-9]{4})')::integer;
  source_week:=substring(p_seed_key from 'W([0-9]{1,2})')::integer;
  season_number:=least(4,greatest(1,ceil(source_week/13.0)::integer));
  key:=source_year::text||'-S'||season_number::text;

  insert into public.last_wave_season_rankings(season_key,player_id,nickname,score,wave,kills,job,weapon)
  values(key,source_row.player_id,source_row.nickname,source_row.score,source_row.wave,source_row.kills,source_row.job,source_row.weapon)
  on conflict(season_key,player_id) do update set
    nickname=excluded.nickname,
    score=greatest(public.last_wave_season_rankings.score,excluded.score),
    wave=case when excluded.score>=public.last_wave_season_rankings.score then excluded.wave else public.last_wave_season_rankings.wave end,
    kills=case when excluded.score>=public.last_wave_season_rankings.score then excluded.kills else public.last_wave_season_rankings.kills end,
    job=case when excluded.score>=public.last_wave_season_rankings.score then excluded.job else public.last_wave_season_rankings.job end,
    weapon=case when excluded.score>=public.last_wave_season_rankings.score then excluded.weapon else public.last_wave_season_rankings.weapon end,
    verified_runs=public.last_wave_season_rankings.verified_runs+1,
    updated_at=now();
  return true;
exception when others then
  return false;
end
$$;

revoke all on function public.lw_refresh_season_ranking_v1(uuid,text) from public,anon,authenticated;

create or replace function public.lw_sync_season_ranking_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lw_refresh_season_ranking_v1(new.player_id,new.seed_key);
  return new;
end
$$;

revoke all on function public.lw_sync_season_ranking_trigger_v1() from public,anon,authenticated;
drop trigger if exists last_wave_weekly_to_season_v1 on public.last_wave_weekly_rankings;
create trigger last_wave_weekly_to_season_v1
after insert or update of score,wave,kills on public.last_wave_weekly_rankings
for each row when (new.verified=true)
execute function public.lw_sync_season_ranking_trigger_v1();
