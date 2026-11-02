-- Failed login counters shared by Edge Function instances.
create table if not exists public.last_wave_auth_attempts (
  key text primary key,
  failures integer not null,
  reset_at timestamptz not null
);

alter table public.last_wave_auth_attempts enable row level security;

create or replace function public.lw_auth_retry_after(p_key text, p_max integer)
returns integer
language sql
set search_path to 'public'
as $$
  select coalesce(
    (
      select ceil(extract(epoch from reset_at - now()))::integer
      from public.last_wave_auth_attempts
      where key = p_key and reset_at > now() and failures >= p_max
    ),
    0
  );
$$;

create or replace function public.lw_auth_record_failure(p_key text, p_window_seconds integer)
returns void
language plpgsql
set search_path to 'public'
as $$
begin
  delete from public.last_wave_auth_attempts where reset_at <= now();
  insert into public.last_wave_auth_attempts as attempts (key, failures, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set failures = attempts.failures + 1;
end;
$$;

revoke all on public.last_wave_auth_attempts from public, anon, authenticated;
revoke all on function public.lw_auth_retry_after(text, integer) from public, anon, authenticated;
revoke all on function public.lw_auth_record_failure(text, integer) from public, anon, authenticated;
grant all on public.last_wave_auth_attempts to service_role;
grant execute on function public.lw_auth_retry_after(text, integer) to service_role;
grant execute on function public.lw_auth_record_failure(text, integer) to service_role;
