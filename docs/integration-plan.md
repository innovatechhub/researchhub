**ResearchHub BNHS — feature integration and homepage plan**

Prepared 5 September 2026 from the supplied requirements, logo, homepage benchmark, and the existing repository. This is a planning deliverable; effort estimates below are provisional engineering estimates.

**1. Scope and source of requirements**

The user's request is to create an integration plan and use the supplied logo and benchmark as the homepage design direction. The attached Word document supplies product requirements, not instructions to execute changes or deploy the application.

The document, `SYSTEM-REQUIREMENTS.docx`, specifies four roles (admin, teachers, students, researchers), teacher selection during submission, automatic chapter division, teachers' assigned-student and submission lists, chapter checking, status and deadline monitoring, and progress reports for teachers and students.

The two images supply the branding and homepage layout. Supporting decisions in this plan—version history, editable chapter boundaries, public metadata previews, and staged migrations—are proposed implementation details. They are not additional requirements stated in the Word document.

Unmodified copies of the supplied images are retained here:

- [ResearchHub BNHS logo](design-references/researchhub-bnhs-logo.jpg)
- [Homepage benchmark](design-references/homepage-benchmark.jpg)

**2. Existing system and gaps**

The application uses React, Vite, Tailwind, React Router, and Supabase Auth, PostgreSQL, and private Storage. Extend its existing presentation → use-case → repository structure.

| Requested capability | Current repository evidence | Planned integration |
| --- | --- | --- |
| Four user roles | Role constants, protected routes, profiles, and role-specific dashboards already exist. Legacy aliases also exist. | Retain four visible roles; preserve compatibility with existing aliases during migration. |
| Select a teacher | Submission form and `researches` have no teacher assignment. | Required teacher selector, eligibility validation, assignment record, and admin reassignment. |
| Automatic chapter division | A single manuscript is uploaded. Existing Mammoth usage is for DOCX-to-text PDF export, not chapter detection. | Extract structure, detect chapter boundaries, preview and correct, persist chapter versions. |
| Assigned students | Teacher dashboard and queue read across submissions; SQL allows teachers broad access. | Add an assignment roster and restrict draft/review access to the assigned teacher. |
| Check per chapter | Comments and approval currently apply to the whole research. | Add chapter viewer, version-specific feedback, revision requests, and chapter decisions. |
| Deadlines and progress | No chapter or deadline tables are present. | Chapter deadlines, shared progress calculations, and teacher/student report screens. |
| Branded public homepage | `/` redirects to login or a dashboard. | Public homepage, preview catalogue, and supporting information pages. |

Existing uploads support PDF, DOC, and DOCX. The storage bucket is private with a configured 50 MiB limit. Existing researchers can browse approved metadata, but the current UI and `restrict_researcher_view_only.sql` deny their file downloads. README language describing researcher downloads is stale relative to these files. No live database configuration was inspected.

**3. Homepage design specification**

Use the original logo without redrawing or distorting it. Create production image sizes during implementation while retaining the supplied original. Use it in the header and footer and derive application icons from the same approved artwork.

Use a white background, deep navy headings and primary buttons, green brand accents, pale green card footers, fine borders, and restrained shadows. Starting color proposals are navy `#08264D`, green `#2C7C2F`, pale green `#F0F7F0`, and text `#182537`; validate contrast before finalizing. These are proposed tokens, not exact sampled colors.

| Page area | Layout and content | Behavior |
| --- | --- | --- |
| Header | Logo; “ResearchHub BNHS”; “Digital Repository for Research Outputs”; Home, About, Browse Research, Guidelines, Contact; navy Login button. | Highlight the active page. Signed-in users see “My Dashboard.” Collapse navigation into an accessible mobile menu. |
| Hero | Left-aligned “Welcome to ResearchHub BNHS,” short repository description, green underline, Browse Research and About the System buttons; school photo on the right with a white gradient behind text. | Buttons lead to `/browse` and `/about`. Keep text as HTML and use the photograph as a separate image asset. |
| Capabilities | Four cards: Store, Preserve, Retrieve, For Everyone. Use the existing icon library and navy/green styling. | Four columns on wide screens, two on tablets, one on phones. |
| Recently Added Research | Three approved research cards with title, authors, brief abstract, and access cue; adjacent login callout. | Load real, eligible records in publication-date order. Provide loading, empty, and retry states; never publish the benchmark's example studies as real records. |
| Footer | Small logo, school name and repository description, location, contact email, and current copyright year. | Use verified school contact details; do not assume the benchmark email is operational. |

The benchmark is a composed screenshot, not a reusable school photograph. Obtain the original BNHS building photo for the hero before visual sign-off. A temporary navy/green background can support development. Do not use the entire screenshot as the homepage or enlarge its embedded school photo as a final asset.

Proposed public routes: `/`, `/about`, `/browse`, `/guidelines`, `/contact`. Preserve `/login` and existing portal routes. Public pages should render without waiting for auth bootstrap; protected routes should continue to wait for confirmed authentication and role resolution. Preserve the intended internal research destination through login, using an allowlisted local return path.

Public previews expose only explicitly selected approved metadata: research ID, title, author display names, abstract excerpt, category, strand, year, and publication date. Use a dedicated server-controlled preview table/projection with read-only access; do not grant anonymous access to the main research, profile, comment, or storage tables. Add `public_preview_enabled`, default false for existing records, and let admins curate eligibility. Remove previews when approval or eligibility is withdrawn.

The initial access model is: guests see eligible previews; authenticated researchers see approved metadata; authorized school users retain approved-file access; working chapters and feedback remain private. Use “Sign in to view research details” rather than promising full manuscripts to every account. Full-text researcher access would be a separate product decision.

**4. Submission and teacher assignment**

The proposed student flow is:

1. Enter research metadata and select an eligible teacher.
2. Upload the manuscript and wait for chapter detection.
3. Review detected chapters, correct boundaries/titles, and identify missing required chapters.
4. Save a draft or submit available chapters for review.
5. See chapter status, comments, deadlines, and completion in the research workspace.

Introduce `teacher_student_assignments` so teachers can see students before they upload anything. Admins manage eligible pairings; students select from their assigned teachers when submitting. If no teacher is available, show an actionable message without losing the draft. A small teacher-directory endpoint should return only eligible IDs and display names, not unrestricted profile records.

Store one responsible `teacher_id` per research. Validate the teacher role and active pairing on the server. Admin reassignment records who changed the assignment and when, updates notifications, and immediately revokes the previous teacher's private draft access. Keep historical reviews attributed to their original author.

The initial model retains the existing submitting student as the account owner. Existing author names are bibliographic metadata, not account permissions. Group-account collaboration can be added later if required.

**5. Chapter detection and review**

Default to a configurable five-chapter template: Introduction; Review of Related Literature; Methodology; Results and Discussion; Summary, Conclusions, and Recommendations. The document does not prescribe chapter count or titles, so school templates must be finalized before acceptance. Store front matter, references, and appendices separately from required-chapter completion.

For DOCX, reuse Mammoth's heading-aware conversion/extraction. Mammoth supports semantic headings but does not promise faithful document layout, and generated HTML requires sanitization. Preserve the original manuscript for authoritative layout review. [Mammoth documentation](https://github.com/mwilliamson/mammoth.js)

For PDFs, evaluate PDF.js for original-document rendering and extraction, then implement chapter detection over the extracted content. The application must supply the chapter-detection logic; a PDF viewer alone does not divide research into chapters. [PDF.js examples](https://mozilla.github.io/pdf.js/examples/)

Detect heading styles, “CHAPTER 1” and Roman-numeral equivalents, and configured chapter titles. Exclude table-of-contents repetitions and running headers; retain source page/paragraph positions. A chapter is initially a logical section tied to its source document, so physical splitting into separate files is unnecessary.

Present detected boundaries for confirmation. Support manual page ranges for PDFs and section boundaries for DOCX when headings are missing or ambiguous. Scanned PDFs require manual page selection or a searchable replacement in the initial release; OCR is a later enhancement. Existing DOC files remain available, but automatic extraction requires conversion to DOCX/PDF or a separately implemented converter. Explain that limitation before upload processing starts.

Use a document-processing job with `queued`, `processing`, `ready`, `needs_input`, and `failed` states. A background worker reads only authorized private objects, produces derived chapter content, and supports bounded retries. Make retries idempotent and prevent late results from replacing a newer version. Set processing resource limits and validate file content and size. Upload or parsing failure must leave a recoverable draft and a clear retry path.

Teachers get a chapter sidebar, source-document viewer, feedback panel, and revision history. Store review decisions against the exact chapter version reviewed. Actions are Approve Chapter, Request Revision, and Add Feedback. Require an explanation for revision requests. Preserve existing whole-research rejection as a distinct action.

New chapter submissions move from `draft` to `submitted`, then `approved` or `needs_revision`. A revision creates a new immutable version and returns that chapter to `submitted`; previous comments remain attached to their version. Record review, status change, and notification atomically to avoid partial updates or duplicate alerts.

Final research approval is a separate explicit action, available only when all required current chapter versions are approved and the final manuscript is present. Never publish working chapter text or feedback. Editing published content creates a new revision cycle; the previous approved artifact remains the published version until a replacement is approved.

**6. Deadlines and progress reports**

Teachers set or adjust deadlines for their assigned research chapters; admins can override. Initially use per-chapter deadlines, with optional bulk assignment to the teacher's roster. Store UTC timestamps and show school time as Asia/Manila. Display “No deadline” explicitly instead of treating null values as overdue.

Use the same server-calculated metrics in both teacher and student views:

- Completion = approved current required chapters / total required chapters × 100. No configured required chapters displays “Not configured,” not 100%.
- Submitted progress is separate from completion; an upload is not an approval.
- Overdue means the current required submission is missing after its deadline. A timely submission awaiting teacher review is “Awaiting review,” not overdue.
- Record late submissions from their actual submitted time and the applicable deadline. Revision requests may set a new due date; preserve previous deadline history.
- A teacher report includes assigned student, research title, approved/required chapters, awaiting-review count, next deadline, late/missing work, and last activity. The student report uses the same data restricted to their own research.

Provide a chapter timeline and table, with filters for student, status, and date. Printable reports and CSV export are useful supporting enhancements after the core report is correct. Preserve a generated-at timestamp and selected filters in exports.

Extend existing in-app notifications for assignment, chapter submission, revision request, approval, and deadline change. Proposed due-soon reminders run once 24 hours before a deadline; overdue reminders run once after it passes. Use a scheduled server job with a deduplication key that includes recipient, chapter, deadline version, and event type. Email/SMS is outside the initial scope.

**7. Data and access changes**

| Entity | Main additions and constraints |
| --- | --- |
| `teacher_student_assignments` | Teacher, student, academic period, active status, created-by; prevent duplicate active pairings. |
| `researches` | Responsible teacher, chapter-template snapshot, published-version reference, public-preview eligibility; support draft creation without requiring an uploaded file. Preserve current review statuses. |
| `research_documents` | Research, immutable version, original file path, format, checksum, uploader, uploaded-at. |
| `document_processing_jobs` | Document version, job state, parser version, attempt count, error, started/finished timestamps. |
| `research_chapters` | Research, ordered chapter identifier, title, required flag, current-version reference; unique order within research. |
| `chapter_versions` | Chapter, version number, source document, boundaries, derived-content path, submission timestamp, review state; unique chapter/version pair. |
| `chapter_reviews` | Exact chapter version, reviewer, decision, comment, suggestion, created-at. |
| `chapter_deadlines` and history | Chapter, due-at, deadline version, reason, changed-by, changed-at; preserve prior deadlines. |
| `research_assignment_history` | Research, old/new teacher, reason, changed-by, changed-at. |
| `notifications` | Chapter/version references, event type, deduplication key. |
| `public_research_previews` | Allowlisted published metadata only; server-maintained and externally read-only. |

Create indexes for teacher/status, student, research/chapter order, document-job state, due timestamps, and notification delivery keys. Validate all cross-record references belong to the same research. Derive progress from source states rather than storing client-editable percentages.

Update database and Storage policies together. Students access their own working research; assigned teachers review it; admins manage all; approved-library access stays separate from private review access. Researchers and guests receive no chapter, deadline, or internal-feedback access. Remove the existing researcher policy that exposes comments on approved research.

Replace broad teacher policies rather than merely adding narrower ones: permissive RLS policies can combine to preserve broad access. Protect role, owner, teacher, publication, and approval fields with server-authorized operations; current own-profile and own-research update policies need field restrictions before relying on the new role/assignment boundaries. Test access directly through database/API calls, not only hidden UI controls. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)

Keep original and derived files private and issue short-lived URLs only after authorization. Stop writing public URLs for private files; retain storage paths as the durable reference. Protect worker credentials outside the frontend. Extend existing backup and cleanup tools for the new relational records and stored files.

**8. Implementation map**

| Area | Existing files to extend | Proposed additions |
| --- | --- | --- |
| Branding and public navigation | `src/app/router.jsx`, `src/core/constants/routes.js`, `tailwind.config.js`, `src/index.css`, `index.html`, `public/manifest.json` | `PublicLayout`, public Home/About/Browse/Guidelines/Contact pages, brand assets, public catalogue repository. |
| Student workflow | `ResearchSubmissionForm.jsx`, student `SubmitResearchPage.jsx` and `DashboardPage.jsx` | Teacher selector, research workspace, chapter preview, progress view. |
| Teacher workflow | Teacher `DashboardPage.jsx` and `Approval.jsx` | Assigned Students, Chapter Review, Deadlines, and Progress pages. |
| Admin support | `UserManagement.jsx`, admin repository and use cases | Assignment management and legacy-record mapping. |
| Domain and persistence | `research.js`, research repositories/use cases, notifications | Chapter, assignment, deadline, and report modules; atomic review operations. |
| Database and processing | Supabase schema and existing patches | Ordered migrations, processing worker, reminder job, access tests. |

Use the existing components, toast layer, icon package, and chart package where suitable. Lazy-load document viewers and conversion libraries so homepage visitors do not download review tooling.

**9. Delivery sequence and estimates**

| Phase | Deliverable | Dependency | Estimated focused effort |
| --- | --- | --- | --- |
| 1 | Additive schema, assignment rules, role/field restrictions, migration fixtures | Confirm current deployed schema and school defaults | 3–4 developer days |
| 2 | Branded public homepage, information routes, restricted preview catalogue, login return flow | Phase 1 preview controls; logo available, school photo needed for final sign-off | 3–4 days |
| 3 | Admin roster, teacher selection, assigned-student list, assignment-only queue | Phase 1 | 2–3 days |
| 4 | Processing worker, automatic detection, editable boundaries, versioned chapter review | Phases 1 and 3 | 6–9 days |
| 5 | Deadlines, common progress calculations, reports, in-app reminders | Phase 4 | 3–4 days |
| 6 | Migration rehearsal, end-to-end checks, responsive review, pilot fixes, rollout | All prior phases | 3–5 days |

Total: approximately **20–29 focused developer days**, excluding waiting for school content, policy decisions, or unfamiliar document-format fixes. Chapter extraction is the largest uncertainty. Validate it early using representative BNHS manuscripts; revise the estimate if OCR or faithful DOC conversion becomes mandatory.

**10. Migration and release approach**

Inspect the deployed schema and which standalone patches have been applied before preparing ordered migrations. Avoid rerunning the whole existing `schema.sql`: it includes auth-data manipulation and account seeding in addition to table definitions.

Back up database records and original objects, then rehearse restoration in staging. Add tables and nullable compatibility fields first. Keep existing manuscripts intact, show legacy chapter progress as “Not assessed,” and route unassigned submissions into an admin mapping queue. Never infer teachers from author names or mark chapters approved solely from the old whole-research status. Existing approved records can remain published under their legacy status while chapter tracking applies to new/reopened work.

Pilot one teacher and a small student group. Use feature flags for chapter submission and public catalogue exposure while keeping previous files and routes usable. Validate the new backup/export coverage. On application rollback, retain additive data and new submissions; restore the earlier UI or disable new entry points without deleting new tables. Do not restore overly broad access policies as a rollback shortcut.

**11. Acceptance criteria**

- The homepage matches the benchmark's structure and visual identity at approximately 375, 768, and 1440 pixels, with readable text, no horizontal overflow, keyboard navigation, visible focus, and working links.
- The supplied logo appears in header/footer and application identity; the hero uses the separate approved school photo; contact text is verified.
- Guests see only eligible approved previews. Direct API and file requests cannot expose drafts, profiles, comments, chapters, or private storage paths through the preview endpoint.
- A student must choose an eligible teacher. That teacher sees the submission and student; another teacher cannot access the private review through a guessed URL or direct API request.
- Representative DOCX and searchable PDF fixtures automatically divide into expected chapters. Roman numerals, contents pages, missing headings, duplicate headings, scanned files, and invalid files produce a correct preview or an explicit correction path.
- Teacher decisions apply to the reviewed version. Resubmission preserves prior feedback and cannot silently reuse old approval. Concurrent edits cannot publish an unreviewed version.
- A timely submission awaiting review is not overdue. Deadline edits, late submission, revision deadlines, and timezone boundaries produce identical teacher/student report results.
- Notifications target the assigned teacher and submitting student and are not duplicated by processing retries or repeated reminder runs.
- Existing approved-library behavior and all four role redirects continue to work. Researcher file restrictions remain enforced.
- Legacy records, migrations, backups, and rollback are exercised in staging. Run `npm run build` and add targeted automated checks for chapter parsing, workflow transitions, report calculations, access rules, and the submission/review journey. The repository currently has no test script; introduce the required test setup during implementation.

**12. Assumptions to resolve during implementation**

The plan can proceed with one responsible teacher per research, admin-managed student/teacher eligibility, a configurable five-chapter starting template, approval-based completion, Asia/Manila deadline display, and metadata-only researcher access. Confirm school-specific chapter templates, reassignment rules, and late-work policy before final workflow acceptance. Obtain the separate school photograph and approved About, Guidelines, Contact, and public-preview content before launch. None of these pending inputs prevents completing this plan.
