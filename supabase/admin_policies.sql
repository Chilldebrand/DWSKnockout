-- DWSKnockout admin policies — run in Supabase SQL Editor

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Admins can manage everything league-related
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
  for update to authenticated using (public.is_admin());

drop policy if exists "admin manage games" on public.games;
create policy "admin manage games" on public.games
  for update to authenticated using (public.is_admin());

drop policy if exists "admin manage picks" on public.picks;
create policy "admin manage picks" on public.picks
  for update to authenticated using (public.is_admin());

-- ============================================================
-- PROMOTE YOURSELF (run AFTER you register on the website):
--
--   update public.profiles set is_admin = true
--   where display_name = 'YOUR_DISPLAY_NAME';
-- ============================================================
