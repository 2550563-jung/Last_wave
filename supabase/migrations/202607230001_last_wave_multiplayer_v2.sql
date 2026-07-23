-- Last Wave v88: capability-authenticated guest multiplayer RPCs.
-- Guest players keep their local UUID, but every mutable room operation also
-- requires an unguessable per-player room token. Only SHA-256 hashes are stored.

alter table public.last_wave_room_members
  add column if not exists session_token_hash text;

create index if not exists last_wave_room_members_active_idx
  on public.last_wave_room_members (room_code, last_seen desc);

create or replace function public.lw_token_hash(p_token text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
$$;

revoke all on function public.lw_token_hash(text) from public, anon, authenticated;

create or replace function public.lw_create_room_v2(
  p_player_id uuid,
  p_nickname text,
  p_job text,
  p_is_public boolean default false,
  p_max_players integer default 4,
  p_session_token text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  clean_nickname text := left(trim(coalesce(p_nickname,'')),16);
  clean_job text := left(trim(coalesce(p_job,'soldier')),32);
begin
  if char_length(clean_nickname)<2 then raise exception '닉네임은 2자 이상이어야 합니다.'; end if;
  if char_length(p_session_token)<32 then raise exception '안전한 방 세션 토큰이 필요합니다.'; end if;
  perform public.lw_cleanup_rooms();
  new_code:=public.lw_make_room_code();
  insert into public.last_wave_rooms(room_code,host_player_id,host_nickname,is_public,status,max_players)
  values(new_code,p_player_id,clean_nickname,p_is_public,'waiting',greatest(2,least(4,p_max_players)));
  insert into public.last_wave_room_members(room_code,player_id,nickname,job,session_token_hash)
  values(new_code,p_player_id,clean_nickname,clean_job,public.lw_token_hash(p_session_token));
  return new_code;
end
$$;

create or replace function public.lw_join_room_v2(
  p_room_code text,
  p_player_id uuid,
  p_nickname text,
  p_job text,
  p_session_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text:=upper(left(trim(coalesce(p_room_code,'')),6));
  room_max integer;
  room_status text;
  active_count integer;
  existing_hash text;
begin
  if char_length(p_session_token)<32 then raise exception '안전한 방 세션 토큰이 필요합니다.'; end if;
  perform public.lw_cleanup_rooms();
  select max_players,status into room_max,room_status
    from public.last_wave_rooms where room_code=clean_code for update;
  if not found then raise exception '존재하지 않는 방입니다.'; end if;

  select session_token_hash into existing_hash
    from public.last_wave_room_members
    where room_code=clean_code and player_id=p_player_id and last_seen>now()-interval '30 minutes';
  if existing_hash is not null and existing_hash<>public.lw_token_hash(p_session_token) then
    raise exception '이미 사용 중인 플레이어 식별자입니다.';
  end if;

  if room_status not in ('waiting','playing') then raise exception '닫힌 방입니다.'; end if;
  if room_status='playing' and existing_hash is null then raise exception '이미 게임이 시작된 방입니다.'; end if;
  select count(*) into active_count from public.last_wave_room_members
    where room_code=clean_code and last_seen>now()-interval '45 seconds';
  if active_count>=room_max and existing_hash is null then raise exception '방이 가득 찼습니다.'; end if;

  insert into public.last_wave_room_members(room_code,player_id,nickname,job,last_seen,session_token_hash)
  values(clean_code,p_player_id,left(trim(p_nickname),16),left(trim(coalesce(p_job,'soldier')),32),now(),public.lw_token_hash(p_session_token))
  on conflict(room_code,player_id) do update set
    nickname=excluded.nickname,job=excluded.job,last_seen=now(),
    session_token_hash=excluded.session_token_hash;
  update public.last_wave_rooms set updated_at=now() where room_code=clean_code;
  return clean_code;
end
$$;

create or replace function public.lw_room_heartbeat_v2(
  p_room_code text,p_player_id uuid,p_session_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare clean_code text:=upper(p_room_code);
begin
  update public.last_wave_room_members set last_seen=now()
  where room_code=clean_code and player_id=p_player_id
    and session_token_hash=public.lw_token_hash(p_session_token);
  if not found then raise exception '방 세션이 만료되었거나 올바르지 않습니다.'; end if;
  update public.last_wave_rooms set updated_at=now() where room_code=clean_code;
end
$$;

create or replace function public.lw_leave_room_v2(
  p_room_code text,p_player_id uuid,p_session_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text:=upper(p_room_code);
  current_host uuid;
  next_host uuid;
  next_nickname text;
begin
  select host_player_id into current_host from public.last_wave_rooms where room_code=clean_code for update;
  delete from public.last_wave_room_members
  where room_code=clean_code and player_id=p_player_id
    and session_token_hash=public.lw_token_hash(p_session_token);
  if not found then raise exception '방 세션이 올바르지 않습니다.'; end if;
  if current_host=p_player_id then
    select player_id,nickname into next_host,next_nickname
      from public.last_wave_room_members where room_code=clean_code
      order by joined_at limit 1;
    if next_host is null then delete from public.last_wave_rooms where room_code=clean_code;
    else update public.last_wave_rooms set host_player_id=next_host,host_nickname=next_nickname,updated_at=now()
      where room_code=clean_code;
    end if;
  end if;
end
$$;

create or replace function public.lw_set_room_status_v2(
  p_room_code text,p_player_id uuid,p_status text,p_session_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('waiting','playing','closed') then raise exception '잘못된 방 상태입니다.'; end if;
  update public.last_wave_rooms room set status=p_status,updated_at=now()
  where room.room_code=upper(p_room_code) and room.host_player_id=p_player_id
    and exists(
      select 1 from public.last_wave_room_members member
      where member.room_code=room.room_code and member.player_id=p_player_id
        and member.session_token_hash=public.lw_token_hash(p_session_token)
    );
  if not found then raise exception '방장 권한을 확인할 수 없습니다.'; end if;
end
$$;

create or replace function public.lw_random_match_v2(
  p_player_id uuid,p_nickname text,p_job text,p_session_token text
)
returns table(room_code text,created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare selected_code text;
begin
  if char_length(p_session_token)<32 then raise exception '안전한 방 세션 토큰이 필요합니다.'; end if;
  perform pg_advisory_xact_lock(hashtext('last-wave-random-match-v2'));
  perform public.lw_cleanup_rooms();
  select room.room_code into selected_code from public.last_wave_rooms room
  where room.is_public=true and room.status='waiting'
    and (select count(*) from public.last_wave_room_members member
      where member.room_code=room.room_code and member.last_seen>now()-interval '45 seconds')<room.max_players
  order by room.created_at limit 1 for update skip locked;
  if selected_code is not null then
    perform public.lw_join_room_v2(selected_code,p_player_id,p_nickname,p_job,p_session_token);
    return query select selected_code::text,false;
    return;
  end if;
  selected_code:=public.lw_create_room_v2(p_player_id,p_nickname,p_job,true,4,p_session_token);
  return query select selected_code::text,true;
end
$$;

revoke all on function public.lw_create_room_v2(uuid,text,text,boolean,integer,text) from public;
revoke all on function public.lw_join_room_v2(text,uuid,text,text,text) from public;
revoke all on function public.lw_room_heartbeat_v2(text,uuid,text) from public;
revoke all on function public.lw_leave_room_v2(text,uuid,text) from public;
revoke all on function public.lw_set_room_status_v2(text,uuid,text,text) from public;
revoke all on function public.lw_random_match_v2(uuid,text,text,text) from public;
grant execute on function public.lw_create_room_v2(uuid,text,text,boolean,integer,text) to anon,authenticated;
grant execute on function public.lw_join_room_v2(text,uuid,text,text,text) to anon,authenticated;
grant execute on function public.lw_room_heartbeat_v2(text,uuid,text) to anon,authenticated;
grant execute on function public.lw_leave_room_v2(text,uuid,text) to anon,authenticated;
grant execute on function public.lw_set_room_status_v2(text,uuid,text,text) to anon,authenticated;
grant execute on function public.lw_random_match_v2(uuid,text,text,text) to anon,authenticated;

-- The v88 client no longer calls mutable legacy RPCs.
revoke execute on function public.lw_create_room(uuid,text,text,boolean,integer) from public,anon,authenticated;
revoke execute on function public.lw_join_room(text,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.lw_room_heartbeat(text,uuid) from public,anon,authenticated;
revoke execute on function public.lw_leave_room(text,uuid) from public,anon,authenticated;
revoke execute on function public.lw_set_room_status(text,uuid,text) from public,anon,authenticated;
revoke execute on function public.lw_random_match(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.lw_cleanup_rooms() from public,anon,authenticated;
revoke execute on function public.lw_make_room_code() from public,anon,authenticated;

-- Direct table access remains closed; all allowed operations go through RPCs.
revoke all on table public.last_wave_rooms from anon,authenticated;
revoke all on table public.last_wave_room_members from anon,authenticated;
