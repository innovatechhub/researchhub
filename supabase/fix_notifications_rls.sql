-- Patch: fix RLS errors when review triggers insert into public.notifications
-- Run this in Supabase SQL Editor on the target project database.

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
