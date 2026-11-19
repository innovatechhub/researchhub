-- Apply once AFTER 202609050001, 202609050002 and 202609050003.
-- Lets a teacher tag a correction/remark with the chapter section it refers to
-- (e.g. "Background of the Study") and, for corrections, a severity (minor/major).
-- Both columns are optional, so existing reviews and callers keep working.
begin;

alter table public.chapter_reviews
  add column if not exists section text check (section is null or length(section) <= 120),
  add column if not exists severity text check (severity is null or severity in ('minor', 'major'));

-- The old 3-argument signature is replaced by one with two defaulted arguments. Dropping it avoids
-- an ambiguous overload for callers that still pass three arguments.
drop function if exists public.workflow_review(uuid, text, text);

create function public.workflow_review(
  p_version uuid,
  p_decision text,
  p_comment text,
  p_section text default null,
  p_severity text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v chapter_versions; c research_chapters; rid uuid;
begin
 select ch.research_id into rid from chapter_versions cv join research_chapters ch on ch.id=cv.chapter_id where cv.id=p_version;
 perform 1 from researches where id=rid for update;
 select * into strict v from chapter_versions where id=p_version for update;
 select * into strict c from research_chapters where id=v.chapter_id for update;
 if not can_review_research(c.research_id) then raise exception 'Assigned teacher required'; end if;
 if c.current_version_id<>v.id or v.status not in ('submitted','approved','needs_revision') then raise exception 'This is not the current submitted chapter'; end if;
 if p_decision not in ('approved','needs_revision','feedback') then raise exception 'Invalid decision'; end if;
 if p_severity is not null and p_severity not in ('minor','major') then raise exception 'Invalid severity'; end if;
 if p_decision in ('needs_revision','feedback') and length(trim(coalesce(p_comment,'')))=0 then raise exception 'Feedback is required'; end if;
 if p_decision<>'feedback' and v.status<>'submitted' then raise exception 'This version has already been reviewed'; end if;
 insert into chapter_reviews(version_id,reviewer_id,decision,comment,section,severity)
   values(v.id,auth.uid(),p_decision,coalesce(p_comment,''),nullif(trim(coalesce(p_section,'')),''),p_severity);
 if p_decision<>'feedback' then update chapter_versions set status=p_decision where id=v.id; end if;
 update researches set updated_at=now() where id=c.research_id;
 perform workflow_notify((select student_id from researches where id=c.research_id),c.research_id,'Chapter review: '||c.title||' — '||replace(p_decision,'_',' '),case when p_decision<>'feedback' then 'review:'||v.id||':'||p_decision else null end);
 perform log_activity(c.research_id, 'chapter_review:' || p_decision, 'Chapter "' || c.title || '" reviewed: ' || p_decision);
end $$;

revoke all on function public.workflow_review(uuid, text, text, text, text) from public, anon;
grant execute on function public.workflow_review(uuid, text, text, text, text) to authenticated;

-- The teacher review queue needs to know which research has chapters sent back for revision.
-- Same query as 202609050001 with one extra aggregate (revision_count); the output is jsonb, so
-- existing readers are unaffected.
create or replace function public.workflow_progress() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (
 select r.id,r.title,r.student_id,r.teacher_id,r.status,r.workflow_enabled,r.updated_at,p.full_name student_name,
 count(c.id) filter(where c.required) required_count,
 count(c.id) filter(where c.required and v.status='approved') approved_count,
 count(c.id) filter(where v.status='submitted') awaiting_count,
 count(c.id) filter(where v.status='needs_revision') revision_count,
 count(c.id) filter(where c.required and (v.id is null or v.status in ('draft','needs_revision')) and d.due_at<now()) overdue_count,
 count(c.id) filter(where v.submitted_at>v.due_at_submission) late_count,
 min(d.due_at) filter(where d.due_at>=now() and (v.id is null or v.status in ('draft','needs_revision'))) next_deadline
 from researches r join profiles p on p.id=r.student_id left join research_chapters c on c.research_id=r.id left join chapter_versions v on v.id=c.current_version_id left join chapter_deadlines d on d.chapter_id=c.id
 where can_work_research(r.id) group by r.id,p.full_name order by r.updated_at desc
 ) s
$$;

commit;
