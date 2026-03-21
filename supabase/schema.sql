-- Research Repository System - Supabase schema
-- Run this file in Supabase SQL Editor.

create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'student' check (role in ('student', 'teacher', 'reviewer', 'admin', 'researcher', 'public_researcher')),
  full_name text,
  track text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.profiles
add column if not exists email text;

alter table if exists public.profiles
add column if not exists track text;

create unique index if not exists idx_profiles_email_unique
on public.profiles (lower(email))
where email is not null;

alter table if exists public.profiles
drop constraint if exists profiles_role_check;

alter table if exists public.profiles
add constraint profiles_role_check
check (
  role in ('student', 'teacher', 'reviewer', 'admin', 'researcher', 'public_researcher')
);

create table if not exists public.roles (
  role_key text primary key,
  role_name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permissions (
  permission_key text primary key,
  permission_name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_permissions (
  role_key text not null references public.roles (role_key) on delete cascade,
  permission_key text not null references public.permissions (permission_key) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_key, permission_key)
);

create table if not exists public.research_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_research_categories_name_unique
on public.research_categories (lower(name));

create table if not exists public.strands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_strands_name_unique
on public.strands (lower(name));

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  strand_id uuid references public.strands (id) on delete set null,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_tracks_name_unique
on public.tracks (lower(name));

create table if not exists public.researches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  abstract text not null,
  authors text[] not null default '{}',
  keywords text[] default '{}',
  strand text not null default 'Unspecified',
  category text not null default 'Uncategorized',
  year integer not null default extract(year from timezone('utc', now()))::int,
  file_path text not null,
  file_url text,
  status text not null default 'pending' check (status in ('pending', 'needs_revision', 'approved', 'rejected')),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.researches
add column if not exists authors text[] not null default '{}';

alter table if exists public.researches
add column if not exists strand text not null default 'Unspecified';

alter table if exists public.researches
add column if not exists category text not null default 'Uncategorized';

alter table if exists public.researches
add column if not exists year integer not null default extract(year from timezone('utc', now()))::int;

alter table if exists public.researches
drop constraint if exists researches_year_check;

alter table if exists public.researches
add constraint researches_year_check check (year between 1900 and 2100);

create index if not exists idx_researches_student_id on public.researches (student_id);
create index if not exists idx_researches_status on public.researches (status);

create table if not exists public.research_comments (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.researches (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  comment text not null,
  suggestion text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_research_comments_research_id on public.research_comments (research_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  research_id uuid references public.researches (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_id_created_at on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_researches_set_updated_at on public.researches;
create trigger trg_researches_set_updated_at
before update on public.researches
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  updated_at = timezone('utc', now())
where
  confirmation_token is null
  or recovery_token is null
  or email_change_token_new is null
  or email_change is null;

update auth.identities i
set
  provider_id = u.id::text,
  identity_data = coalesce(i.identity_data, '{}'::jsonb)
    || jsonb_build_object('sub', u.id::text, 'email', lower(u.email), 'email_verified', true),
  updated_at = timezone('utc', now())
from auth.users u
where i.user_id = u.id
  and i.provider = 'email'
  and u.email is not null
  and (
    i.provider_id is distinct from u.id::text
    or coalesce(i.identity_data ->> 'sub', '') <> u.id::text
    or coalesce(i.identity_data ->> 'email', '') <> lower(u.email)
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
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', lower(u.email), 'email_verified', true),
  'email',
  u.id::text,
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where u.email is not null
  and not exists (
    select 1
    from auth.identities i
    where i.user_id = u.id
      and i.provider = 'email'
  );

with ranked_email_identities as (
  select
    id,
    row_number() over (
      partition by user_id, provider
      order by created_at desc nulls last, id desc
    ) as rn
  from auth.identities
  where provider = 'email'
)
delete from auth.identities i
using ranked_email_identities r
where i.id = r.id
  and r.rn > 1;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_user_role() to authenticated, anon;

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

create or replace function public.admin_delete_user_account(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can delete users.';
  end if;

  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    raise exception 'User does not exist.';
  end if;

  delete from auth.identities
  where user_id = p_user_id;

  delete from auth.users
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_delete_user_account(uuid) to authenticated;

create or replace function public.admin_update_user_password(
  p_user_id uuid,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can update passwords.';
  end if;

  if p_user_id is null then
    raise exception 'User id is required.';
  end if;

  if coalesce(length(p_new_password), 0) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    raise exception 'User does not exist.';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = timezone('utc', now())
  where id = p_user_id;
end;
$$;

grant execute on function public.admin_update_user_password(uuid, text) to authenticated;

create or replace function public.notify_teachers_after_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, research_id, message)
  select
    p.id,
    new.id,
    format('New research "%s" has been submitted and is pending review.', new.title)
  from public.profiles p
  where p.role in ('teacher', 'reviewer');

  return new;
end;
$$;

drop trigger if exists trg_notify_teachers_after_submission on public.researches;
create trigger trg_notify_teachers_after_submission
after insert on public.researches
for each row
execute function public.notify_teachers_after_submission();

create or replace function public.notify_student_after_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('needs_revision', 'approved', 'rejected') then
    insert into public.notifications (user_id, research_id, message)
    values (
      new.student_id,
      new.id,
      format('Your research "%s" has been reviewed. Status: %s', new.title, replace(new.status, '_', ' '))
    );
  end if;

  if new.status in ('needs_revision', 'approved', 'rejected') then
    new.reviewed_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_research_review_notification on public.researches;
create trigger trg_research_review_notification
before update of status on public.researches
for each row
execute function public.notify_student_after_review();

alter table public.profiles enable row level security;
alter table public.researches enable row level security;
alter table public.research_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.research_categories enable row level security;
alter table public.strands enable row level security;
alter table public.tracks enable row level security;

drop policy if exists "Students read own profile" on public.profiles;
create policy "Students read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Students insert own profile" on public.profiles;
create policy "Students insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Students update own profile" on public.profiles;
create policy "Students update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Admins manage all profiles" on public.profiles;
create policy "Admins manage all profiles"
on public.profiles
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Students read own researches" on public.researches;
create policy "Students read own researches"
on public.researches
for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "Students read approved researches archive" on public.researches;
create policy "Students read approved researches archive"
on public.researches
for select
to authenticated
using (
  status = 'approved'
  and public.current_user_role() = 'student'
);

drop policy if exists "Students insert own researches" on public.researches;
create policy "Students insert own researches"
on public.researches
for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists "Students update own pending researches" on public.researches;
create policy "Students update own pending researches"
on public.researches
for update
to authenticated
using (auth.uid() = student_id and status = 'pending')
with check (auth.uid() = student_id);

drop policy if exists "Teachers read all researches" on public.researches;
create policy "Teachers read all researches"
on public.researches
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
);

drop policy if exists "Teachers update research review status" on public.researches;
create policy "Teachers update research review status"
on public.researches
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
);

drop policy if exists "Admins delete researches" on public.researches;
create policy "Admins delete researches"
on public.researches
for delete
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists "Researchers read approved researches" on public.researches;
create policy "Researchers read approved researches"
on public.researches
for select
to authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('researcher', 'public_researcher')
  )
);

drop policy if exists "Students read comments on own research" on public.research_comments;
create policy "Students read comments on own research"
on public.research_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.researches r
    where r.id = research_id and r.student_id = auth.uid()
  )
);

drop policy if exists "Teachers read research comments" on public.research_comments;
create policy "Teachers read research comments"
on public.research_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
);

drop policy if exists "Researchers read comments on approved research" on public.research_comments;
create policy "Researchers read comments on approved research"
on public.research_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.researches r
    where r.id = research_id
      and r.status = 'approved'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('researcher', 'public_researcher')
  )
);

drop policy if exists "Teachers insert research comments" on public.research_comments;
create policy "Teachers insert research comments"
on public.research_comments
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
  and exists (
    select 1
    from public.researches r
    where r.id = research_id
  )
);

drop policy if exists "Students read own notifications" on public.notifications;
create policy "Students read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Students update own notifications" on public.notifications;
create policy "Students update own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Admins read all notifications" on public.notifications;
create policy "Admins read all notifications"
on public.notifications
for select
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists "Authenticated read research categories" on public.research_categories;
create policy "Authenticated read research categories"
on public.research_categories
for select
to authenticated
using (true);

drop policy if exists "Admins manage research categories" on public.research_categories;
create policy "Admins manage research categories"
on public.research_categories
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Authenticated read strands" on public.strands;
create policy "Authenticated read strands"
on public.strands
for select
to authenticated
using (true);

drop policy if exists "Admins manage strands" on public.strands;
create policy "Admins manage strands"
on public.strands
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Authenticated read tracks" on public.tracks;
create policy "Authenticated read tracks"
on public.tracks
for select
to authenticated
using (true);

drop policy if exists "Admins manage tracks" on public.tracks;
create policy "Admins manage tracks"
on public.tracks
for all
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-files',
  'research-files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

update storage.buckets
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'research-files';

drop policy if exists "Students upload own research files" on storage.objects;
create policy "Students upload own research files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'research-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students read own research files" on storage.objects;
create policy "Students read own research files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'research-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students read approved research files archive" on storage.objects;
create policy "Students read approved research files archive"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'research-files'
  and public.current_user_role() = 'student'
  and exists (
    select 1
    from public.researches r
    where r.file_path = name
      and r.status = 'approved'
  )
);

drop policy if exists "Teachers and admins read research files" on storage.objects;
create policy "Teachers and admins read research files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'research-files'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('teacher', 'reviewer', 'admin')
  )
);

drop policy if exists "Researchers read approved research files" on storage.objects;

insert into public.roles (role_key, role_name, description)
values
  ('student', 'Student', 'Student users who submit research and receive review feedback.'),
  ('teacher', 'Teacher / Reviewer', 'Teachers assigned to review research and decide outcomes.'),
  ('admin', 'Admin', 'System administrators who manage users, categories, and platform operations.'),
  ('researcher', 'Researchers (Public Users)', 'Users who browse and view approved research outputs.')
on conflict (role_key) do update
set
  role_name = excluded.role_name,
  description = excluded.description;

insert into public.permissions (permission_key, permission_name, description)
values
  ('login', 'Login', 'Authenticate and access the system.'),
  ('submit_research', 'Submit research', 'Create a new research submission record.'),
  ('upload_research_file', 'Upload research file', 'Upload manuscript files attached to a submission.'),
  ('receive_comments', 'Receive comments', 'Read reviewer comments on submitted research.'),
  ('receive_suggestions', 'Receive suggestions', 'Read reviewer suggestions for improvements.'),
  ('receive_review_notification', 'Receive notification after review', 'Get status notifications after reviewer decisions.'),
  ('review_research', 'Review research', 'Access and review assigned research submissions.'),
  ('add_comments', 'Add comments', 'Add reviewer comments to a research submission.'),
  ('add_suggestions', 'Add suggestions', 'Add reviewer suggestions to a research submission.'),
  ('approve_research', 'Approve research', 'Mark a submission as approved.'),
  ('reject_research', 'Reject research', 'Mark a submission as rejected.'),
  ('manage_users', 'Manage users', 'Create, update, or deactivate system users.'),
  ('manage_categories', 'Manage categories', 'Manage research categories.'),
  ('manage_strands', 'Manage strands', 'Manage academic strands.'),
  ('manage_tracks', 'Manage tracks', 'Manage academic tracks.'),
  ('monitor_research_submissions', 'Monitor research submissions', 'View and monitor all submitted research.'),
  ('perform_system_cleanup', 'Perform system cleanup', 'Execute maintenance cleanup activities.'),
  ('perform_system_backups', 'Perform system backups', 'Run and manage backup operations.'),
  ('browse_approved_research', 'Browse approved research', 'Browse only approved research outputs.'),
  ('search_research', 'Search research', 'Search available approved research outputs.'),
  ('view_research_details', 'View research details', 'Open and read metadata/details of approved research.'),
  ('download_approved_research', 'Download approved research', 'Download files for approved research outputs.')
on conflict (permission_key) do update
set
  permission_name = excluded.permission_name,
  description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('student', 'login'),
  ('student', 'submit_research'),
  ('student', 'upload_research_file'),
  ('student', 'receive_comments'),
  ('student', 'receive_suggestions'),
  ('student', 'receive_review_notification'),

  ('teacher', 'login'),
  ('teacher', 'review_research'),
  ('teacher', 'add_comments'),
  ('teacher', 'add_suggestions'),
  ('teacher', 'approve_research'),
  ('teacher', 'reject_research'),

  ('admin', 'login'),
  ('admin', 'manage_users'),
  ('admin', 'manage_categories'),
  ('admin', 'manage_strands'),
  ('admin', 'manage_tracks'),
  ('admin', 'monitor_research_submissions'),
  ('admin', 'perform_system_cleanup'),
  ('admin', 'perform_system_backups'),

  ('researcher', 'login'),
  ('researcher', 'browse_approved_research'),
  ('researcher', 'search_research'),
  ('researcher', 'view_research_details')
on conflict (role_key, permission_key) do nothing;

insert into public.research_categories (name)
values
  ('Applied Research'),
  ('Basic Research'),
  ('Action Research')
on conflict do nothing;

insert into public.strands (name)
values
  ('STEM'),
  ('ABM'),
  ('HUMSS'),
  ('ICT')
on conflict do nothing;

do $$
declare
  admin_email constant text := 'admin@admin.com';
  admin_password constant text := 'Admin123';
  admin_user_id uuid;
begin
  select u.id
  into admin_user_id
  from auth.users u
  where u.email = admin_email
  limit 1;

  if admin_user_id is null then
    admin_user_id := gen_random_uuid();

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
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      '',
      '',
      '',
      '',
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role', 'admin'),
      timezone('utc', now()),
      timezone('utc', now())
    );
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
    where id = admin_user_id;
  end if;

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
  select
    gen_random_uuid(),
    admin_user_id,
    jsonb_build_object('sub', admin_user_id::text, 'email', admin_email, 'email_verified', true),
    'email',
    admin_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  where not exists (
    select 1
    from auth.identities i
    where i.user_id = admin_user_id
      and i.provider = 'email'
  );

  insert into public.profiles (id, email, role, full_name)
  values (admin_user_id, admin_email, 'admin', 'System Admin')
  on conflict (id) do update
  set
    email = excluded.email,
    role = 'admin';
end;
$$;
