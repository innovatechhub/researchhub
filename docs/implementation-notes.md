**ResearchHub BNHS implementation and release notes**

The application now includes the branded public homepage, information pages, public research catalogue, assignment management, private research workspaces, chapter extraction and review, deadlines, progress reports, CSV/print reports, and public-preview curation.

**Local setup**

Use Node 22 or newer. Run `npm ci`, create a local `.env` from `.env.example`, and configure the correct Supabase project URL and browser key. The browser must never receive a service-role key. Run `npm run dev`.

The homepage renders without a database connection. When a connection exists but the migration has not been applied, the public catalogue shows a retryable error. New workflow screens require the migration below.

Optional branding settings:

```dotenv
VITE_SCHOOL_HERO_IMAGE=/brand/bnhs-campus.jpg
VITE_SCHOOL_CONTACT_EMAIL=
```

Place the original school photo in `public/brand/bnhs-campus.jpg` and set the first variable to use it. Until then, the homepage uses the supplied logo with a navy/green background. Set the email only after the school confirms the address. About and Guidelines contain general repository instructions; school-specific policy copy still needs school review.

**Database deployment**

1. Identify the target project and inspect its existing schema/patch history. The migration expects the existing ResearchHub schema and the `research-files` private storage bucket. It does not create or reset administrator credentials.
2. Take a database backup and a copy of the original storage objects. Rehearse restoration on a separate project before production.
3. Apply `supabase/migrations/202609050001_research_workflow.sql` once to staging, after the existing base schema. Use the migration system or the SQL editor. Do not rerun the old full `schema.sql` on an existing installation: it includes account/password seeding and auth-data updates.
4. Deploy the application against that staging project. Verify each role using actual school test accounts. The migration intentionally replaces broad teacher access with assigned-research access and removes direct client writes to reviews/ownership/approval fields.
5. In Admin → Teacher Assignments, create teacher/student pairings and map legacy unassigned research. Existing published research retains its existing status; chapter progress stays unassessed for legacy records.
6. Use Admin → Public Previews to opt approved records into the public catalogue. All existing records start with previews disabled.
7. Enable Supabase Cron, then apply `supabase/enable_deadline_reminders.sql`. It calls `workflow_reminders()` every 15 minutes and deduplicates events by chapter/deadline version. Check execution history in the project. The setup follows the [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart).
8. Repeat the verified migration/deployment sequence for production after the pilot. Vercel route rewrites are included, but no deployment is performed by this code change.

**Portal redesign (DOMA-TECH mockups)**

Teacher and student dashboards, the portal sidebar/header and the navy theme follow the DOMA-TECH mockups. Apply `supabase/migrations/202609050004_review_sections.sql` (after 001–003) before deploying this UI: it adds optional `section` and `severity` columns to `chapter_reviews`, extends `workflow_review` with two defaulted arguments, and adds `revision_count` to `workflow_progress`. Without it, saving a correction from the teacher dashboard fails. Chapter feedback is shown as one thread across all versions, so earlier comments stay visible after a resubmission. Section text on the dashboards is split from the chapter text when a section title appears alone on a line; otherwise the full chapter text is available under "Read the full chapter text". The older `student/DashboardPage.jsx`, `teacher/DashboardPage.jsx` and `teacher/Approval.jsx` are no longer routed.

**Document processing and review behavior**

Portal layout fixes (19 November 2026): student chapter/content columns now stack on phones and tablets; long titles and file names wrap without widening the page. Teacher and student portals use the mockups' narrower sidebar and larger header. The teacher's correction editor sits alongside the selected section's feedback, and changing its Section selector opens the matching accordion. Desktop chapter panels scroll independently so revision/submission history remains easier to reach; mobile feedback is fully expanded. Queue detail requests ignore stale responses when search or selection changes. Missing section text still links to the full chapter and original manuscript; it is not fabricated. These changes require no additional database migration and do not establish that the updated frontend has been deployed.

Upload the original manuscript first; its private object and processing job are recorded before parsing. DOCX text extraction runs in a browser Web Worker. PDF.js uses its worker to extract text and preserves physical page boundaries for scanned files. Processing is initiated by the signed-in student; keep the tab open during extraction. A persisted queued/failed/interrupted job can be retried from the manuscript list, up to three attempts, or the student can upload a replacement. This is a browser-worker implementation, not an always-running server extraction service.

The server persists extraction results and validates chapter references, source-document ownership, ranges, current versions, and review permissions. Detection is a convenience; students confirm boundaries and teachers verify the original file. DOCX uses paragraph ranges; PDF uses page ranges. Text previews do not preserve DOCX tables or figures, so original files remain authoritative. Older `.doc` files need conversion to PDF/DOCX; scanned PDFs use manual page boundaries. OCR and fully automatic layout reconstruction are not included.

Research is created as a private draft. Chapter submissions retain immutable content and version-specific reviews; submitting a new version resets that chapter's approval. Final approval requires every required current chapter to be approved from the selected final manuscript. This deliberately ensures the published document matches what was reviewed. Published research remains available during revisions until replaced by another final approval. Whole-research rejection removes it from the library and previews.

Progress uses the same database query for both teachers and students. Approved chapters count toward completion; submissions awaiting review do not become overdue. Due-date edits are recorded in history, and submission timing is compared to the deadline captured when that version was submitted. Dates display in Asia/Manila.

**Backup and rollback**

`node scripts/backup.mjs <new-output-directory>` exports workflow tables and referenced original files. Supply `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the shell. The script refuses an existing destination and writes the completed manifest last. `node scripts/verify-backup.mjs <output-directory>` verifies file sizes and checksums. The export complements a database backup; it is not a replacement for a consistent database/auth snapshot. Pause submissions during a release backup or use a consistent database snapshot.

On rollback, retain additive workflow tables and uploaded originals. Pause new workflow entry points or deploy the previous compatible application. Do not restore broad teacher access policies. Pause reminders with `select cron.unschedule('researchhub-chapter-deadlines');`. Restore databases and files only into a verified target using the rehearsed backup procedure.

**Validation**

Run `npm test`, `npm run test:browser`, and `npm run build`. Database tests execute the actual migration in PGlite with representative Supabase auth/storage schemas and verify role access, teacher assignments, versioned reviews, publication, deadlines, and reminder deduplication. Browser tests cover responsive public pages and a DOCX submission journey. This harness does not replace a staging test against Supabase Auth, Storage, PostgREST, and Cron.

Live project migration, live identity/storage checks, reminder scheduling, production deployment, a school pilot, the original campus photo, and confirmed contact copy remain release steps that need the target environment or school input.
