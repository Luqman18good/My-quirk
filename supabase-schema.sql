create table if not exists public.hud_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hud_profiles enable row level security;

grant select, insert, update, delete on public.hud_profiles to authenticated;

drop policy if exists "Users manage their own HUD profile" on public.hud_profiles;
create policy "Users manage their own HUD profile"
  on public.hud_profiles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);