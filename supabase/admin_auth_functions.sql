-- DWSKnockout admin account management — run in Supabase SQL Editor
-- Lets admins reset a player's password (temporary password) or change their email.

-- Store email on profiles so admins can see who they're managing
alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

-- Backfill emails for existing users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ============ ADMIN-ONLY ACCOUNT FUNCTIONS ============

create or replace function public.admin_reset_password(target_user_id uuid, temp_password text)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  if length(temp_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  update auth.users
  set encrypted_password = crypt(temp_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = target_user_id;

  -- Force re-login everywhere
  delete from auth.sessions where user_id = target_user_id;
  delete from auth.refresh_tokens where user_id = target_user_id;
end;
$$;

create or replace function public.admin_change_email(target_user_id uuid, new_email text)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  new_email := lower(trim(new_email));
  if new_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email address';
  end if;

  update auth.users
  set email = new_email,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_user_id;

  update auth.identities
  set email = new_email
  where user_id = target_user_id and provider = 'email';

  update public.profiles
  set email = new_email
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_change_email(uuid, text) to authenticated;
revoke execute on function public.admin_reset_password(uuid, text) from anon;
revoke execute on function public.admin_change_email(uuid, text) from anon;
