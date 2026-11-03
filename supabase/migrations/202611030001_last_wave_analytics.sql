-- Anonymous visit statistics. No IP address, nickname or account is stored.
create table if not exists public.last_wave_analytics (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Seoul')::date),
  visitor_id uuid not null,
  event text not null check (event in ('visit','run_start','run_end','share','feedback')),
  source text not null default 'direct',
  device text not null default 'unknown',
  first_visit boolean not null default false,
  version text not null default '',
  mode text not null default '',
  wave integer
);
create index if not exists last_wave_analytics_day_idx on public.last_wave_analytics (day, event);
create index if not exists last_wave_analytics_visitor_idx on public.last_wave_analytics (visitor_id, event);
alter table public.last_wave_analytics enable row level security;
revoke all on public.last_wave_analytics from public, anon, authenticated;
grant all on public.last_wave_analytics to service_role;

alter table public.last_wave_feedback
  add column if not exists plays integer,
  add column if not exists source text not null default '';

create or replace function public.lw_analytics_summary(p_days integer default 14)
returns jsonb
language sql
stable
set search_path = public
as $$
  with recent as (
    select * from public.last_wave_analytics
    where day > ((now() at time zone 'Asia/Seoul')::date - greatest(1, least(p_days, 90)))
  ),
  newcomers as (
    select distinct visitor_id from recent where event = 'visit' and first_visit
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(d order by d.day desc) from (
        select day,
          count(distinct visitor_id) filter (where event = 'visit') as visitors,
          count(distinct visitor_id) filter (where event = 'visit' and first_visit) as new_visitors,
          count(*) filter (where event = 'run_start') as run_starts,
          count(*) filter (where event = 'run_end') as run_ends,
          count(*) filter (where event = 'share') as shares,
          count(*) filter (where event = 'feedback') as feedback
        from recent group by day
      ) d), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(s order by s.visitors desc) from (
        select source, count(distinct visitor_id) as visitors
        from recent where event = 'visit' group by source
      ) s), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(s order by s.visitors desc) from (
        select device, count(distinct visitor_id) as visitors
        from recent where event = 'visit' group by device
      ) s), '[]'::jsonb),
    'newcomers', jsonb_build_object(
      'visited', (select count(*) from newcomers),
      'started', (select count(distinct r.visitor_id) from recent r join newcomers n using (visitor_id) where r.event = 'run_start'),
      'finished', (select count(distinct r.visitor_id) from recent r join newcomers n using (visitor_id) where r.event = 'run_end'),
      'returned', (select count(*) from (
        select r.visitor_id from recent r join newcomers n using (visitor_id)
        where r.event = 'visit' group by r.visitor_id having count(distinct r.day) > 1
      ) x)
    )
  );
$$;
revoke all on function public.lw_analytics_summary(integer) from public, anon, authenticated;
grant execute on function public.lw_analytics_summary(integer) to service_role;
