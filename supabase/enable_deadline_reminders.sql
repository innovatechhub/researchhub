-- Run once in the target project's SQL editor after the workflow migration.
-- Requires Supabase Cron (pg_cron) to be enabled in that project.
-- Re-running this statement updates the named job rather than creating duplicates.
select cron.schedule(
  'researchhub-chapter-deadlines',
  '*/15 * * * *',
  'select public.workflow_reminders();'
);
-- To pause: select cron.unschedule('researchhub-chapter-deadlines');
