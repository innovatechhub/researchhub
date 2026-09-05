-- Apply once AFTER 202609050001_research_workflow.sql.
-- Lets a student resubmit their own rejected research under the same record
-- (same id, same comment/version history) instead of creating a duplicate submission.
begin;

create function public.workflow_resubmit(p_research uuid) returns void language plpgsql security definer set search_path=public as $$
declare r researches;
begin
  select * into strict r from researches where id=p_research for update;
  if r.student_id<>auth.uid() or current_user_role()<>'student' then raise exception 'Research owner required'; end if;
  if r.status<>'rejected' then raise exception 'Only rejected research can be resubmitted'; end if;
  insert into research_comments(research_id,author_id,comment) values(p_research,auth.uid(),'Student resubmitted this research after rejection.');
  update researches set status='draft' where id=p_research;
end $$;

grant execute on function public.workflow_resubmit(uuid) to authenticated;

commit;
