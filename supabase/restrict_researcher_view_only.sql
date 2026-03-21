-- Patch: allow creating researcher accounts, but keep researcher access view-only.
-- Run this in Supabase SQL Editor for existing deployments.

create or replace function public.admin_create_user_account(
  p_full_name text,
  p_email text,
  p_role text,
  p_password text,
  p_strand text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_role text;
  v_full_name text;
  v_strand text;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can create users.';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  v_role := lower(trim(coalesce(p_role, '')));
  v_full_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_strand := nullif(trim(coalesce(p_strand, '')), '');

  if v_role = 'reviewer' then
    v_role := 'teacher';
  end if;

  if v_role = 'public_researcher' then
    v_role := 'researcher';
  end if;

  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  if v_role not in ('student', 'teacher', 'admin', 'researcher') then
    raise exception 'Invalid role.';
  end if;

  if coalesce(length(p_password), 0) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if v_role = 'student' and v_strand is null then
    raise exception 'Strand is required for student.';
  end if;

  if exists (
    select 1
    from auth.users u
    where lower(u.email) = v_email
  ) then
    raise exception 'Email already exists.';
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    '',
    '',
    '',
    '',
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', v_role),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.profiles (id, email, role, full_name, track)
  values (
    v_user_id,
    v_email,
    v_role,
    v_full_name,
    case when v_role = 'student' then v_strand else null end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = excluded.role,
    full_name = excluded.full_name,
    track = excluded.track;

  return v_user_id;
end;
$$;

grant execute on function public.admin_create_user_account(text, text, text, text, text) to authenticated;

drop policy if exists "Researchers read approved research files" on storage.objects;

update public.roles
set description = 'Users who browse and view approved research outputs.'
where role_key = 'researcher';

delete from public.role_permissions
where role_key = 'researcher'
  and permission_key = 'download_approved_research';
