-- Apply once AFTER 202609050001_research_workflow.sql and 202609050002_research_resubmit.sql.
-- Adds an admin-only activity/audit log covering key workflow events:
-- research submission, chapter review decisions, research approval/rejection,
-- resubmission, and teacher assignment changes.
--
-- Each function below is copied verbatim from its prior definition (202609050001 or
-- 202609050002) with only a `perform log_activity(...)` call added, so behavior is
-- unchanged apart from the new logging. Parameter names/order are kept identical to
-- the originals so `create or replace` updates the existing function rather than
-- creating an overload.
begin;

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  research_id uuid references public.researches(id) on delete set null,
  event_key text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index activity_log_created_at on public.activity_log(created_at desc);
create index activity_log_research_id on public.activity_log(research_id);

alter table public.activity_log enable row level security;

create policy activity_log_admin_read on public.activity_log for select to authenticated
using (current_user_role() = 'admin');

create function public.log_activity(p_research uuid, p_event_key text, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_log(actor_id, research_id, event_key, message)
  values (auth.uid(), p_research, p_event_key, p_message);
end $$;

-- Log new research submissions.
create or replace function public.workflow_create(p_metadata jsonb,p_teacher uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; titles jsonb;
begin
 if current_user_role()<>'student' then raise exception 'Student access required'; end if;
 if not exists(select 1 from teacher_student_assignments a join profiles p on p.id=a.teacher_id where a.student_id=auth.uid() and a.teacher_id=p_teacher and a.active and p.role in ('teacher','reviewer')) then raise exception 'Select an assigned teacher'; end if;
 if length(trim(coalesce(p_metadata->>'title','')))=0 or length(trim(coalesce(p_metadata->>'abstract','')))=0 or jsonb_array_length(coalesce(p_metadata->'authors','[]'))=0 then raise exception 'Title, abstract and authors are required'; end if;
 if not exists(select 1 from strands where name=p_metadata->>'strand') or not exists(select 1 from research_categories where name=p_metadata->>'category') then raise exception 'Select an available strand and category'; end if;
 insert into researches(student_id,teacher_id,title,abstract,authors,keywords,strand,category,year,status,workflow_enabled)
 values(auth.uid(),p_teacher,trim(p_metadata->>'title'),trim(p_metadata->>'abstract'),array(select jsonb_array_elements_text(p_metadata->'authors')),array(select jsonb_array_elements_text(coalesce(p_metadata->'keywords','[]'))),p_metadata->>'strand',p_metadata->>'category',(p_metadata->>'year')::integer,'draft',true) returning id into rid;
 select chapter_template into titles from workflow_settings where id=true;
 insert into research_chapters(research_id,position,title) select rid,ordinality,value from jsonb_array_elements_text(titles) with ordinality;
 perform log_activity(rid, 'research_created', 'Research draft created: ' || trim(p_metadata->>'title'));
 return rid;
end $$;

-- Log chapter review decisions.
create or replace function public.workflow_review(p_version uuid,p_decision text,p_comment text) returns void language plpgsql security definer set search_path=public as $$
declare v chapter_versions; c research_chapters; rid uuid;
begin
 select ch.research_id into rid from chapter_versions cv join research_chapters ch on ch.id=cv.chapter_id where cv.id=p_version;
 perform 1 from researches where id=rid for update;
 select * into strict v from chapter_versions where id=p_version for update;
 select * into strict c from research_chapters where id=v.chapter_id for update;
 if not can_review_research(c.research_id) then raise exception 'Assigned teacher required'; end if;
 if c.current_version_id<>v.id or v.status not in ('submitted','approved','needs_revision') then raise exception 'This is not the current submitted chapter'; end if;
 if p_decision not in ('approved','needs_revision','feedback') then raise exception 'Invalid decision'; end if;
 if p_decision in ('needs_revision','feedback') and length(trim(coalesce(p_comment,'')))=0 then raise exception 'Feedback is required'; end if;
 if p_decision<>'feedback' and v.status<>'submitted' then raise exception 'This version has already been reviewed'; end if;
 insert into chapter_reviews(version_id,reviewer_id,decision,comment) values(v.id,auth.uid(),p_decision,coalesce(p_comment,''));
 if p_decision<>'feedback' then update chapter_versions set status=p_decision where id=v.id; end if;
 update researches set updated_at=now() where id=c.research_id;
 perform workflow_notify((select student_id from researches where id=c.research_id),c.research_id,'Chapter review: '||c.title||' — '||replace(p_decision,'_',' '),case when p_decision<>'feedback' then 'review:'||v.id||':'||p_decision else null end);
 perform log_activity(c.research_id, 'chapter_review:' || p_decision, 'Chapter "' || c.title || '" reviewed: ' || p_decision);
end $$;

-- Log final approval.
create or replace function public.workflow_publish(p_research uuid,p_document uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare r researches; path text;
begin
 select * into strict r from researches where id=p_research for update;
 if not can_review_research(r.id) then raise exception 'Assigned teacher required'; end if;
 if r.workflow_enabled then
   if not exists(select 1 from research_chapters where research_id=r.id and required) or exists(select 1 from research_chapters c left join chapter_versions v on v.id=c.current_version_id where c.research_id=r.id and c.required and (v.id is null or v.status<>'approved' or v.document_id is distinct from p_document)) then raise exception 'All required chapters must be approved from the selected final manuscript'; end if;
   select file_path into path from research_documents where id=p_document and research_id=r.id;
   if path is null then raise exception 'Final manuscript required'; end if;
 else path:=r.file_path; if path is null then raise exception 'Final manuscript required'; end if; end if;
 update researches set status='approved',file_path=path,file_url=null,published_snapshot=jsonb_build_object('title',title,'authors',authors,'abstract_excerpt',left(abstract,280),'category',category,'strand',strand,'year',year,'published_at',now()) where id=r.id;
 perform log_activity(r.id, 'research_approved', 'Research approved: ' || r.title);
end $$;

-- Log rejection / needs_revision decisions on the whole research.
create or replace function public.workflow_research_review(p_research uuid,p_status text,p_comment text,p_suggestion text default '') returns void language plpgsql security definer set search_path=public as $$
declare r researches;
begin
 select * into strict r from researches where id=p_research for update;
 if not can_review_research(p_research) then raise exception 'Assigned teacher required'; end if;
 if p_status is not null and p_status not in ('approved','rejected','needs_revision') then raise exception 'Invalid status'; end if;
 if p_status in ('rejected','needs_revision') and length(trim(coalesce(p_comment,'')))=0 then raise exception 'Comment required'; end if;
 if length(trim(coalesce(p_comment,'')||coalesce(p_suggestion,'')))>0 then insert into research_comments(research_id,author_id,comment,suggestion) values(p_research,auth.uid(),coalesce(nullif(p_comment,''),'Reviewer suggestion'),p_suggestion); end if;
 if p_status='approved' then perform workflow_publish(p_research,null);
 elsif p_status is not null then
   update researches set status=p_status where id=p_research;
   perform log_activity(p_research, 'research_' || p_status, 'Research ' || p_status || ': ' || r.title);
 end if;
end $$;

-- Log resubmission.
create or replace function public.workflow_resubmit(p_research uuid) returns void language plpgsql security definer set search_path=public as $$
declare r researches;
begin
  select * into strict r from researches where id=p_research for update;
  if r.student_id<>auth.uid() or current_user_role()<>'student' then raise exception 'Research owner required'; end if;
  if r.status<>'rejected' then raise exception 'Only rejected research can be resubmitted'; end if;
  insert into research_comments(research_id,author_id,comment) values(p_research,auth.uid(),'Student resubmitted this research after rejection.');
  update researches set status='draft' where id=p_research;
  perform log_activity(p_research, 'research_resubmitted', 'Research resubmitted: ' || r.title);
end $$;

-- Log teacher assignment changes.
create or replace function public.workflow_assign(p_teacher uuid,p_student uuid,p_period text,p_active boolean default true) returns void language plpgsql security definer set search_path=public as $$
begin
 if current_user_role()<>'admin' then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from profiles where id=p_teacher and role in ('teacher','reviewer')) or not exists(select 1 from profiles where id=p_student and role='student') then raise exception 'Choose a teacher and student'; end if;
 if length(trim(p_period))=0 then raise exception 'Academic period required'; end if;
 if not p_active and exists(select 1 from researches where teacher_id=p_teacher and student_id=p_student and status not in ('approved','rejected')) then raise exception 'Reassign active research before removing this pairing'; end if;
 update teacher_student_assignments set active=false where teacher_id=p_teacher and student_id=p_student;
 insert into teacher_student_assignments(teacher_id,student_id,academic_period,active,created_by) values(p_teacher,p_student,trim(p_period),p_active,auth.uid()) on conflict(teacher_id,student_id,academic_period) do update set active=excluded.active;
 if p_active then perform workflow_notify(p_student,null,'Your research teacher assignment has been updated.',null); end if;
 perform log_activity(null, 'teacher_assignment:' || case when p_active then 'assigned' else 'unassigned' end, 'Teacher assignment ' || case when p_active then 'created' else 'removed' end || ' for period ' || trim(p_period));
end $$;

grant execute on function public.log_activity(uuid, text, text) to authenticated;

commit;
