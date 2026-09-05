-- Apply once AFTER the existing schema. This migration never seeds or changes passwords.
begin;
alter table public.researches add column if not exists teacher_id uuid references public.profiles(id);
alter table public.researches add column if not exists public_preview_enabled boolean not null default false;
alter table public.researches add column if not exists workflow_enabled boolean not null default false;
alter table public.researches add column if not exists published_snapshot jsonb;
alter table public.researches alter column file_path drop not null;
alter table public.researches drop constraint if exists researches_status_check;
alter table public.researches add constraint researches_status_check check(status in ('draft','pending','needs_revision','approved','rejected'));
create index if not exists researches_teacher_status on public.researches(teacher_id,status);

create table public.teacher_student_assignments (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id),
 student_id uuid not null references public.profiles(id), academic_period text not null,
 active boolean not null default true, created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 unique(teacher_id,student_id,academic_period)
);
create unique index assignment_active_pair on public.teacher_student_assignments(teacher_id,student_id) where active;
create table public.research_assignment_history (
 id uuid primary key default gen_random_uuid(),research_id uuid not null references public.researches(id) on delete cascade,
 old_teacher_id uuid references public.profiles(id),new_teacher_id uuid references public.profiles(id),reason text not null,
 changed_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table public.workflow_settings (
 id boolean primary key default true check(id), chapter_template jsonb not null,
 check(jsonb_typeof(chapter_template)='array' and jsonb_array_length(chapter_template) between 1 and 20)
);
insert into public.workflow_settings values(true,'["Introduction","Review of Related Literature","Methodology","Results and Discussion","Summary, Conclusions, and Recommendations"]');
create table public.research_documents (
 id uuid primary key default gen_random_uuid(), research_id uuid not null references public.researches(id) on delete cascade,
 file_path text not null unique,format text not null check(format in ('pdf','docx')),checksum text not null,
 uploaded_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.document_processing_jobs (
 id uuid primary key default gen_random_uuid(),document_id uuid not null unique references public.research_documents(id) on delete cascade,
 state text not null default 'queued' check(state in ('queued','processing','ready','needs_input','failed')),
 parser_version text not null default '1',attempts integer not null default 0,
 result jsonb,error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index processing_job_state on public.document_processing_jobs(state);
create table public.research_chapters (
 id uuid primary key default gen_random_uuid(),research_id uuid not null references public.researches(id) on delete cascade,
 position integer not null check(position between 1 and 20),title text not null,required boolean not null default true,
 current_version_id uuid,unique(research_id,position)
);
create table public.chapter_versions (
 id uuid primary key default gen_random_uuid(),chapter_id uuid not null references public.research_chapters(id) on delete cascade,
 document_id uuid not null references public.research_documents(id) on delete cascade,version_number integer not null,
 start_block integer not null check(start_block>=0),end_block integer not null check(end_block>=start_block),
 content text not null default '',status text not null check(status in ('draft','submitted','approved','needs_revision')),
 submitted_at timestamptz,due_at_submission timestamptz,created_at timestamptz not null default now(),unique(chapter_id,version_number)
);
alter table public.research_chapters add constraint chapters_current_version_fk foreign key(current_version_id) references public.chapter_versions(id) on delete set null;
create table public.chapter_reviews (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.chapter_versions(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id),decision text not null check(decision in ('approved','needs_revision','feedback')),
 comment text not null default '',created_at timestamptz not null default now()
);
create table public.chapter_deadlines (
 chapter_id uuid primary key references public.research_chapters(id) on delete cascade,due_at timestamptz,
 version integer not null default 1,changed_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
create index chapter_deadline_due on public.chapter_deadlines(due_at);
create table public.chapter_deadline_history (
 id uuid primary key default gen_random_uuid(),chapter_id uuid not null references public.research_chapters(id) on delete cascade,
 due_at timestamptz,version integer not null,reason text not null,changed_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table public.public_research_previews (
 research_id uuid primary key references public.researches(id) on delete cascade,title text not null,authors text[] not null,
 abstract_excerpt text not null,category text,strand text,year integer,published_at timestamptz not null
);
create table public.storage_cleanup_queue (
 file_path text primary key,created_at timestamptz not null default now()
);
alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from anon,authenticated;
grant select,delete on public.storage_cleanup_queue to authenticated;
create policy cleanup_admin_read on public.storage_cleanup_queue for select to authenticated using(current_user_role()='admin');
create policy cleanup_admin_delete on public.storage_cleanup_queue for delete to authenticated using(current_user_role()='admin');
create function public.queue_research_file_cleanup() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into storage_cleanup_queue(file_path) select old.file_path where old.file_path is not null on conflict do nothing;
 insert into storage_cleanup_queue(file_path) select file_path from research_documents where research_id=old.id on conflict do nothing;
 return old;
end $$;
create trigger research_file_cleanup before delete on public.researches for each row execute function public.queue_research_file_cleanup();
revoke all on function public.queue_research_file_cleanup() from public,anon,authenticated;
alter table public.notifications add column if not exists event_key text;
create unique index notifications_event_key on public.notifications(event_key) where event_key is not null;

-- Authorization helpers use the database profile, never caller-supplied roles.
create function public.workflow_staff() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() in ('teacher','reviewer','admin'),false) $$;
create function public.can_work_research(p_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from researches r where r.id=p_id and (current_user_role()='admin' or (r.student_id=auth.uid() and current_user_role()='student') or (r.teacher_id=auth.uid() and current_user_role() in ('teacher','reviewer')))) $$;
create function public.can_review_research(p_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select workflow_staff() and can_work_research(p_id) $$;
create function public.can_work_chapter(p_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from research_chapters c where c.id=p_id and can_work_research(c.research_id)) $$;
create function public.can_work_version(p_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from chapter_versions v where v.id=p_id and can_work_chapter(v.chapter_id)) $$;
create function public.can_work_document(p_id uuid) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from research_documents d where d.id=p_id and can_work_research(d.research_id)) $$;

-- All mutations below are explicit RPC operations; direct review/role/ownership writes are revoked.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','researches','research_comments') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
create policy profiles_self_read on public.profiles for select to authenticated using(id=auth.uid() or current_user_role()='admin');
create policy profiles_admin_write on public.profiles for all to authenticated using(current_user_role()='admin') with check(current_user_role()='admin');
create policy research_read on public.researches for select to authenticated using(can_work_research(id) or (status='approved' and auth.uid() is not null));
create policy research_admin_delete on public.researches for delete to authenticated using(current_user_role()='admin');
create policy comments_private_read on public.research_comments for select to authenticated using(can_work_research(research_id));
revoke insert,update on public.researches from authenticated;
revoke insert,update,delete on public.research_comments from authenticated;

do $$ declare t text; begin
 foreach t in array array['teacher_student_assignments','research_assignment_history','workflow_settings','research_documents','document_processing_jobs','research_chapters','chapter_versions','chapter_reviews','chapter_deadlines','chapter_deadline_history','public_research_previews'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy assignment_read on public.teacher_student_assignments for select to authenticated using(current_user_role()='admin' or teacher_id=auth.uid() or student_id=auth.uid());
create policy assignment_history_read on public.research_assignment_history for select to authenticated using(can_work_research(research_id));
create policy settings_read on public.workflow_settings for select to authenticated using(true);
create policy documents_read on public.research_documents for select to authenticated using(can_work_research(research_id));
create policy jobs_read on public.document_processing_jobs for select to authenticated using(can_work_document(document_id));
create policy chapters_read on public.research_chapters for select to authenticated using(can_work_research(research_id));
create policy versions_read on public.chapter_versions for select to authenticated using(can_work_chapter(chapter_id));
create policy reviews_read on public.chapter_reviews for select to authenticated using(can_work_version(version_id));
create policy deadlines_read on public.chapter_deadlines for select to authenticated using(can_work_chapter(chapter_id));
create policy deadline_history_read on public.chapter_deadline_history for select to authenticated using(can_work_chapter(chapter_id));
grant select on public.public_research_previews to anon;
create policy previews_read on public.public_research_previews for select to anon,authenticated using(true);

-- New accounts always start as students. Privileged creation RPCs set the profile afterwards.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,email,role) values(new.id,new.email,'student') on conflict(id) do update set email=excluded.email; return new; end $$;
-- A null role must never pass the existing privileged account functions' checks.
create or replace function public.current_user_role() returns text language sql stable security definer set search_path=public
as $$ select coalesce((select role from profiles where id=auth.uid()),'anonymous') $$;

drop trigger if exists trg_notify_teachers_after_submission on public.researches;
create function public.workflow_notify(p_user uuid,p_research uuid,p_message text,p_key text) returns void language sql security definer set search_path=public
as $$ insert into notifications(user_id,research_id,message,event_key) select p_user,p_research,p_message,p_key where p_user is not null on conflict(event_key) where event_key is not null do nothing $$;

create function public.workflow_directory() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',coalesce(p.full_name,'School user'),'role',p.role)) from profiles p
 where current_user_role()='admin' or p.id=auth.uid() or exists(select 1 from teacher_student_assignments a where a.active and ((a.student_id=auth.uid() and a.teacher_id=p.id) or (a.teacher_id=auth.uid() and a.student_id=p.id))) or exists(select 1 from researches r where can_work_research(r.id) and p.id in (r.student_id,r.teacher_id))),'[]'::jsonb);
end $$;
create function public.workflow_assign(p_teacher uuid,p_student uuid,p_period text,p_active boolean default true) returns void language plpgsql security definer set search_path=public as $$
begin
 if current_user_role()<>'admin' then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from profiles where id=p_teacher and role in ('teacher','reviewer')) or not exists(select 1 from profiles where id=p_student and role='student') then raise exception 'Choose a teacher and student'; end if;
 if length(trim(p_period))=0 then raise exception 'Academic period required'; end if;
 if not p_active and exists(select 1 from researches where teacher_id=p_teacher and student_id=p_student and status not in ('approved','rejected')) then raise exception 'Reassign active research before removing this pairing'; end if;
 update teacher_student_assignments set active=false where teacher_id=p_teacher and student_id=p_student;
 insert into teacher_student_assignments(teacher_id,student_id,academic_period,active,created_by) values(p_teacher,p_student,trim(p_period),p_active,auth.uid()) on conflict(teacher_id,student_id,academic_period) do update set active=excluded.active;
 if p_active then perform workflow_notify(p_student,null,'Your research teacher assignment has been updated.',null); end if;
end $$;
create function public.workflow_reassign(p_research uuid,p_teacher uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare r researches;
begin
 if current_user_role()<>'admin' then raise exception 'Administrator access required'; end if;
 select * into strict r from researches where id=p_research for update;
 if not exists(select 1 from teacher_student_assignments where student_id=r.student_id and teacher_id=p_teacher and active) then raise exception 'Create an active student/teacher pairing first'; end if;
 if length(trim(p_reason))=0 then raise exception 'Reason required'; end if;
 update researches set teacher_id=p_teacher where id=r.id;
 insert into research_assignment_history(research_id,old_teacher_id,new_teacher_id,reason,changed_by) values(r.id,r.teacher_id,p_teacher,p_reason,auth.uid());
 perform workflow_notify(p_teacher,r.id,'Research assigned: '||r.title,null);
 perform workflow_notify(r.student_id,r.id,'Your research teacher has changed: '||r.title,null);
end $$;
create function public.workflow_template(p_titles jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if current_user_role()<>'admin' then raise exception 'Administrator access required'; end if;
 if jsonb_typeof(p_titles)<>'array' or jsonb_array_length(p_titles) not between 1 and 20 or exists(select 1 from jsonb_array_elements_text(p_titles) t where length(trim(t))=0 or length(t)>200) then raise exception 'Provide 1 to 20 chapter titles'; end if;
 update workflow_settings set chapter_template=p_titles where id=true;
end $$;
create function public.workflow_create(p_metadata jsonb,p_teacher uuid) returns uuid language plpgsql security definer set search_path=public as $$
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
 return rid;
end $$;
create function public.workflow_register_document(p_research uuid,p_path text,p_format text,p_checksum text) returns uuid language plpgsql security definer set search_path=public as $$
declare did uuid;
begin
 perform 1 from researches where id=p_research and student_id=auth.uid() and workflow_enabled and status<>'rejected' for update;
 if not found or current_user_role()<>'student' then raise exception 'You cannot upload to this research'; end if;
 if p_path not like auth.uid()::text||'/'||p_research::text||'/%' then raise exception 'Invalid file location'; end if;
 if not exists(select 1 from storage.objects where bucket_id='research-files' and name=p_path) then raise exception 'Upload the original file first'; end if;
 insert into research_documents(research_id,file_path,format,checksum,uploaded_by) values(p_research,p_path,p_format,p_checksum,auth.uid()) returning id into did;
 insert into document_processing_jobs(document_id) values(did);
 return did;
end $$;
create function public.workflow_process(p_document uuid,p_state text,p_result jsonb default null,p_error text default null) returns void language plpgsql security definer set search_path=public as $$
declare j document_processing_jobs;
begin
 if not exists(select 1 from research_documents d join researches r on r.id=d.research_id where d.id=p_document and r.student_id=auth.uid()) or current_user_role()<>'student' then raise exception 'Document owner required'; end if;
 select * into strict j from document_processing_jobs where document_id=p_document for update;
 if j.state in ('ready','needs_input') then return; end if;
 if p_state='processing' then
   if j.attempts>=3 then raise exception 'Retry limit reached. Upload the document again'; end if;
   update document_processing_jobs set state='processing',attempts=attempts+1,error=null,updated_at=now() where id=j.id;
 elsif p_state in ('ready','needs_input') then
   if j.state<>'processing' or jsonb_typeof(p_result->'blocks')<>'array' or jsonb_array_length(p_result->'blocks') not between 1 and 20000 or octet_length(p_result::text)>10000000 then raise exception 'Invalid extraction result'; end if;
   update document_processing_jobs set state=p_state,result=p_result,error=null,updated_at=now() where id=j.id;
 elsif p_state='failed' then update document_processing_jobs set state='failed',error=left(p_error,500),updated_at=now() where id=j.id;
 else raise exception 'Invalid processing state'; end if;
end $$;
create function public.workflow_save_chapters(p_research uuid,p_document uuid,p_chapters jsonb,p_submit boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare r researches; c research_chapters; item jsonb; blocks jsonb; vid uuid; n integer; a integer; b integer; chapter_text text; due timestamptz;
begin
 select * into strict r from researches where id=p_research for update;
 if r.student_id<>auth.uid() or current_user_role()<>'student' or not r.workflow_enabled or r.status='rejected' then raise exception 'Research owner required'; end if;
 if not exists(select 1 from research_documents where id=p_document and research_id=r.id) then raise exception 'Document does not belong to this research'; end if;
 select result->'blocks' into blocks from document_processing_jobs where document_id=p_document and state in ('ready','needs_input');
 if blocks is null then raise exception 'Finish processing the document first'; end if;
 if p_chapters is null or jsonb_typeof(p_chapters)<>'array' or jsonb_array_length(p_chapters) not between 1 and 20 then raise exception 'Select at least one chapter'; end if;
 if exists(select 1 from jsonb_array_elements(p_chapters) with ordinality a(value,n) join jsonb_array_elements(p_chapters) with ordinality b(value,n) on a.n<b.n where (a.value->>'start_block')::int <= (b.value->>'end_block')::int and (b.value->>'start_block')::int <= (a.value->>'end_block')::int) then raise exception 'Chapter ranges must not overlap'; end if;
 for item in select value from jsonb_array_elements(p_chapters) loop
   select * into strict c from research_chapters where id=(item->>'chapter_id')::uuid and research_id=r.id for update;
   if (item->>'expected_version')::uuid is distinct from c.current_version_id then raise exception 'This chapter changed. Reload before saving'; end if;
   a:=(item->>'start_block')::integer; b:=(item->>'end_block')::integer;
   if a is null or b is null or a<0 or b<a or b>=jsonb_array_length(blocks) then raise exception 'Invalid chapter boundaries'; end if;
   select string_agg(value->>'text',E'\n\n' order by ordinality) into chapter_text from jsonb_array_elements(blocks) with ordinality where ordinality between a+1 and b+1;
   select coalesce(max(version_number),0)+1 into n from chapter_versions where chapter_id=c.id;
   select due_at into due from chapter_deadlines where chapter_id=c.id;
   insert into chapter_versions(chapter_id,document_id,version_number,start_block,end_block,content,status,submitted_at,due_at_submission)
   values(c.id,p_document,n,a,b,coalesce(chapter_text,''),case when p_submit then 'submitted' else 'draft' end,case when p_submit then now() end,case when p_submit then due end) returning id into vid;
   update research_chapters set current_version_id=vid where id=c.id;
   if p_submit then perform workflow_notify(r.teacher_id,r.id,'Chapter submitted: '||c.title||' — '||r.title,'submitted:'||vid); end if;
 end loop;
 update researches set status=case when status='approved' then status when p_submit then 'pending' else status end,updated_at=now() where id=r.id;
end $$;
create function public.workflow_submit_drafts(p_research uuid) returns void language plpgsql security definer set search_path=public as $$
declare r researches; c record;
begin
 select * into strict r from researches where id=p_research for update;
 if r.student_id<>auth.uid() or current_user_role()<>'student' or r.status='rejected' then raise exception 'Research owner required'; end if;
 for c in select ch.id,ch.title,v.id vid,d.due_at from research_chapters ch join chapter_versions v on v.id=ch.current_version_id left join chapter_deadlines d on d.chapter_id=ch.id where ch.research_id=r.id and v.status='draft' loop
   update chapter_versions set status='submitted',submitted_at=now(),due_at_submission=c.due_at where id=c.vid;
   perform workflow_notify(r.teacher_id,r.id,'Chapter submitted: '||c.title||' — '||r.title,'submitted:'||c.vid);
 end loop;
 if r.status<>'approved' then update researches set status='pending' where id=r.id; end if;
end $$;
create function public.workflow_review(p_version uuid,p_decision text,p_comment text) returns void language plpgsql security definer set search_path=public as $$
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
end $$;
create function public.workflow_deadline(p_chapter uuid,p_due timestamptz,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare c research_chapters; n integer;
begin
 select * into strict c from research_chapters where id=p_chapter for update;
 if not can_review_research(c.research_id) then raise exception 'Assigned teacher required'; end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Reason required'; end if;
 insert into chapter_deadlines(chapter_id,due_at,changed_by) values(c.id,p_due,auth.uid()) on conflict(chapter_id) do update set due_at=excluded.due_at,version=chapter_deadlines.version+1,changed_by=auth.uid(),updated_at=now() returning version into n;
 insert into chapter_deadline_history(chapter_id,due_at,version,reason,changed_by) values(c.id,p_due,n,p_reason,auth.uid());
 perform workflow_notify((select student_id from researches where id=c.research_id),c.research_id,'Deadline updated: '||c.title,'deadline:'||c.id||':'||n);
end $$;
create function public.workflow_publish(p_research uuid,p_document uuid default null) returns void language plpgsql security definer set search_path=public as $$
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
end $$;
create function public.workflow_research_review(p_research uuid,p_status text,p_comment text,p_suggestion text default '') returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from researches where id=p_research for update;
 if not can_review_research(p_research) then raise exception 'Assigned teacher required'; end if;
 if p_status is not null and p_status not in ('approved','rejected','needs_revision') then raise exception 'Invalid status'; end if;
 if p_status in ('rejected','needs_revision') and length(trim(coalesce(p_comment,'')))=0 then raise exception 'Comment required'; end if;
 if length(trim(coalesce(p_comment,'')||coalesce(p_suggestion,'')))>0 then insert into research_comments(research_id,author_id,comment,suggestion) values(p_research,auth.uid(),coalesce(nullif(p_comment,''),'Reviewer suggestion'),p_suggestion); end if;
 if p_status='approved' then perform workflow_publish(p_research,null);
 elsif p_status is not null then update researches set status=p_status where id=p_research; end if;
end $$;
create function public.sync_research_preview() returns trigger language plpgsql security definer set search_path=public as $$
declare snap jsonb;
begin
 if new.status='approved' and new.public_preview_enabled then
   snap:=coalesce(new.published_snapshot,jsonb_build_object('title',new.title,'authors',new.authors,'abstract_excerpt',left(new.abstract,280),'category',new.category,'strand',new.strand,'year',new.year,'published_at',coalesce(new.reviewed_at,new.submitted_at)));
   insert into public_research_previews values(new.id,snap->>'title',array(select jsonb_array_elements_text(snap->'authors')),snap->>'abstract_excerpt',snap->>'category',snap->>'strand',(snap->>'year')::int,(snap->>'published_at')::timestamptz)
   on conflict(research_id) do update set title=excluded.title,authors=excluded.authors,abstract_excerpt=excluded.abstract_excerpt,category=excluded.category,strand=excluded.strand,year=excluded.year,published_at=excluded.published_at;
 else delete from public_research_previews where research_id=new.id; end if;
 return new;
end $$;
create trigger workflow_preview after insert or update on public.researches for each row execute function public.sync_research_preview();
create function public.workflow_preview(p_research uuid,p_enabled boolean) returns void language plpgsql security definer set search_path=public as $$
begin if current_user_role()<>'admin' then raise exception 'Administrator access required'; end if; update researches set public_preview_enabled=p_enabled where id=p_research; end $$;

-- One authoritative progress query for both portals; submitted work is never overdue while awaiting review.
create function public.workflow_progress() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (
 select r.id,r.title,r.student_id,r.teacher_id,r.status,r.workflow_enabled,r.updated_at,p.full_name student_name,
 count(c.id) filter(where c.required) required_count,
 count(c.id) filter(where c.required and v.status='approved') approved_count,
 count(c.id) filter(where v.status='submitted') awaiting_count,
 count(c.id) filter(where c.required and (v.id is null or v.status in ('draft','needs_revision')) and d.due_at<now()) overdue_count,
 count(c.id) filter(where v.submitted_at>v.due_at_submission) late_count,
 min(d.due_at) filter(where d.due_at>=now() and (v.id is null or v.status in ('draft','needs_revision'))) next_deadline
 from researches r join profiles p on p.id=r.student_id left join research_chapters c on c.research_id=r.id left join chapter_versions v on v.id=c.current_version_id left join chapter_deadlines d on d.chapter_id=c.id
 where can_work_research(r.id) group by r.id,p.full_name order by r.updated_at desc
 ) s
$$;
create function public.workflow_reminders() returns integer language plpgsql security definer set search_path=public as $$
declare c record; n integer:=0; before_count integer;
begin
 for c in select ch.id,ch.title,ch.research_id,r.student_id,d.version,d.due_at from chapter_deadlines d join research_chapters ch on ch.id=d.chapter_id join researches r on r.id=ch.research_id left join chapter_versions v on v.id=ch.current_version_id where r.status<>'rejected' and (v.id is null or v.status in ('draft','needs_revision')) and d.due_at<now()+interval '24 hours' loop
   insert into notifications(user_id,research_id,message,event_key) values(c.student_id,c.research_id,case when c.due_at<now() then 'Overdue: ' else 'Due soon: ' end||c.title,'reminder:'||c.id||':'||c.version||':'||case when c.due_at<now() then 'overdue' else 'soon' end) on conflict(event_key) where event_key is not null do nothing;
   get diagnostics before_count=row_count; n:=n+before_count;
 end loop; return n;
end $$;

-- Remove old broad storage policies and permit only ownership, assigned reviews, or the published file.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (policyname in ('Students upload own research files','Students read own research files','Students read approved research files archive','Teachers and admins read research files','Researchers read approved research files') or qual like '%research-files%' or with_check like '%research-files%') loop execute format('drop policy %I on storage.objects',p.policyname); end loop;
end $$;
create policy workflow_file_upload on storage.objects for insert to authenticated with check(bucket_id='research-files' and current_user_role()='student' and (storage.foldername(name))[1]=auth.uid()::text);
create policy workflow_file_read on storage.objects for select to authenticated using(bucket_id='research-files' and (
 current_user_role()='admin' or (current_user_role()='student' and (storage.foldername(name))[1]=auth.uid()::text)
 or exists(select 1 from researches r where r.file_path=name and (can_review_research(r.id) or (r.status='approved' and current_user_role() in ('student','teacher','reviewer'))))
 or exists(select 1 from research_documents d where d.file_path=name and can_review_research(d.research_id))));
create policy workflow_orphan_delete on storage.objects for delete to authenticated using(bucket_id='research-files' and (current_user_role()='admin' or (current_user_role()='student' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from research_documents where file_path=name) and not exists(select 1 from researches where file_path=name))));

-- SECURITY DEFINER helpers are never implicitly executable by PUBLIC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'workflow_%' or p.proname like 'can_work_%' or p.proname='can_review_research' or p.proname='sync_research_preview') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 if f.proname not in ('workflow_notify','workflow_reminders','sync_research_preview') then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
grant execute on function public.workflow_reminders() to service_role;
commit;
