create table if not exists public.last_wave_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 2 and 2000),
  nickname text not null default '',
  version text not null default ''
);

alter table public.last_wave_feedback enable row level security;
revoke all on public.last_wave_feedback from public, anon, authenticated;
grant all on public.last_wave_feedback to service_role;
