**ResearchHub BNHS — panelist feedback backlog**

Prepared 5 September 2026 from panel review suggestions; updated 5 September 2026 to record implementation status. Scope for each item was clarified with the project owner before being recorded here.

**Important discovery during implementation:** the student submission flow has two parallel implementations in the codebase — an older flat-submission module (`presentation/pages/student/`, `presentation/components/research/ResearchSubmissionForm.jsx`) and a newer chapter-based workflow module (`presentation/pages/workflow/`). Only the workflow module is wired into the router (`app/router.jsx`) and reachable by users; the older module is dead code. All fixes below target the live workflow module unless noted.

**1. Admin panel**

| # | Request | Clarified scope | Status |
| --- | --- | --- | --- |
| A1 | Filter for options (school year) | Add a school-year filter to admin research/records listing(s). | **Done.** Added a "School Year" dropdown filter to `presentation/pages/admin/Research.jsx`, matching the existing Category/Strand filter pattern. |
| A2 | Include Reports | Reports feature covering: (a) submission/approval statistics broken down by school year, strand, status, and teacher; (b) exportable file output — CSV first, per project owner's choice, PDF can follow later; (c) an activity/audit log of key workflow events (research submitted, chapter reviewed, research approved/rejected, resubmitted, teacher assignment changed). Login events explicitly excluded per project owner's choice. | **Done**, pending one manual step. New `presentation/pages/admin/Reports.jsx` at `/admin/reports`: stat breakdown cards (year/strand/status/teacher) computed from `researches` rows the admin can already read, a "Recent Activity" table reading the new `activity_log` table, and CSV export buttons for both. New SQL migration `supabase/migrations/202609050003_activity_log.sql` adds the `activity_log` table (admin-read-only via RLS) and a `log_activity()` helper, and re-defines the six workflow functions that represent key events (`workflow_create`, `workflow_review`, `workflow_publish`, `workflow_research_review`, `workflow_resubmit`, `workflow_assign`) with a single added logging call each — every other line of each function body is unchanged from the prior migration. **This migration still needs to be run against the Supabase project's SQL Editor, after 202609050001 and 202609050002, before Reports will show real data.** PDF export was not built — only CSV, per the project owner's stated preference to start there. |
| A3 | Edit while offline, sync when reconnected | Full offline-first support: local draft storage, service worker/offline caching, sync queue with conflict resolution, online/offline status indicator. | Not started. Confirmed as full scope, not a lightweight "don't lose my typed data" fallback. Significant engineering effort (PWA-level) — recommend treating as a separate phase/epic. |

**2. Student panel**

| # | Request | Clarified scope | Status |
| --- | --- | --- | --- |
| S1 | Remove analytics | Strip all charts/graphs/comparative stats from the student view; student should see only their own submission status. | **Done.** Removed `ResearchAnalyticsPanel` from `presentation/pages/student/DashboardPage.jsx`. (Note: this dashboard page is separate from the live workflow `ProgressPage` — confirm with the project owner whether `ProgressPage` shows any analytics to students that also need removing.) |
| S2 | Comments for correction/suggestions | Add a reviewer-to-student comment/feedback feature tied to a submission (or a section of it). | **Confirmed already satisfied.** The live workflow already has this: `chapter_reviews` lets a reviewer leave a comment plus a decision (`feedback` / `needs_revision` / `approved`) tied to a specific chapter version, shown to the student in `ResearchWorkspace.jsx` under "Feedback on this version" with a timestamp. No reference form was available to match a specific college template, and the project owner confirmed this generic version is sufficient. |
| S3 | "Year / Posted" instead of "Published" | Cosmetic label change: wherever the UI currently shows "Published," change the text to "Posted." | **Done.** Changed "Open published/original file" → "Open posted/original file" in `presentation/components/research/ResearchList.jsx` (the only "Published" wording reachable by students; this component belongs to the dead flat-submission module, but was the only place the word appeared for students). Live workflow pages (`ResearchWorkspace.jsx`, `ProgressPage.jsx`) show status pills built from the raw `pending` / `needs_revision` / `approved` / `rejected` values and never render the word "Published," so no change was needed there. |
| S4 | Reject → Resubmit button | When a submission is rejected, keep the same submission record/ID and comment history; give the student a "Resubmit" action tied to that same record. | **Done**, pending one manual step. Added SQL function `workflow_resubmit(p_research uuid)` in `supabase/migrations/202609050002_research_resubmit.sql` (owner-only, only while `status = 'rejected'`, resets to `draft` and logs a comment) and a "Resubmit this research" button in `ResearchWorkspace.jsx`, shown to the owner only while their research is rejected. **The migration still needs to be run against the Supabase project's SQL Editor before this works.** |
| S5 | One-time registration during research upload | Student fills in personal/group registration details once; future research submissions reuse/auto-fill from that saved profile data. | **Done.** `AuthProvider.jsx` now exposes the signed-in user's `profile` (`full_name`, `track`) via `useAuth()`; `presentation/pages/workflow/NewResearchPage.jsx` (the live submission form) pre-fills the Authors and Strand fields from it, without overwriting anything the student has already typed. |

**3. Remaining work**

Only A3 remains open. S2 required no new code. S1/S3/S4/S5/A1/A2 are implemented per the table above.

1. A3 (offline-first editing) — largest and most independent; can be scheduled as its own phase whenever convenient.

**4. Open questions for later**

- A2: which specific stats matter most to admins (per-strand? per-teacher? turnaround time?) — needed before building the audit log schema.
- A3: which forms/pages need offline support — all admin forms, or a specific subset (e.g., review/approval actions only)?
- S1: resolved — checked `ProgressPage.jsx` (the live student "My research" view, also shared by teacher/admin routes). It shows only a per-research completion percentage and progress bar, which is the student's own submission status, not comparative charts/analytics — left unchanged. No further action needed.
