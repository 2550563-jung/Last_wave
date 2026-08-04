-- Last Wave v109: local play and multiplayer no longer require a nickname.
-- Rankings retain their existing nickname validation and are skipped by the client when blank.

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
  if char_length(p_session_token)<32 then
    raise exception 'A secure room session token is required.';
  end if;
  perform public.lw_cleanup_rooms();
  new_code:=public.lw_make_room_code();
  insert into public.last_wave_rooms(room_code,host_player_id,host_nickname,is_public,status,max_players)
  values(new_code,p_player_id,clean_nickname,p_is_public,'waiting',greatest(2,least(4,p_max_players)));
  insert into public.last_wave_room_members(room_code,player_id,nickname,job,session_token_hash)
  values(new_code,p_player_id,clean_nickname,clean_job,public.lw_token_hash(p_session_token));
  return new_code;
end
$$;

revoke all on function public.lw_create_room_v2(uuid,text,text,boolean,integer,text) from public;
grant execute on function public.lw_create_room_v2(uuid,text,text,boolean,integer,text) to anon,authenticated;
