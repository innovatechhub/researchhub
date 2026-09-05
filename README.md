# ResearchHub BNHS

ResearchHub now includes a branded public homepage, curated research previews, teacher assignments, chapter-based submission and review, deadlines, and progress reports. See [implementation and release notes](docs/implementation-notes.md) for setup, migration order, document-processing limits, and validation.

Existing installations must apply [the workflow migration](supabase/migrations/202609050001_research_workflow.sql) before using the new portal screens. Do not rerun the base schema against an existing installation because it contains account seeding. Deadline reminders also require [Cron setup](supabase/enable_deadline_reminders.sql).

Role-based web application for student submissions, teacher review workflows, and researcher access to approved research outputs.

## Stack

- Frontend: React + Vite, Tailwind CSS, React Router, Axios
- Backend: Supabase (PostgreSQL, Auth, Storage)
- Deployment: Vercel

## Core Features

- Sign in and role-based dashboard redirect (`student`, `teacher`, `admin`, `researcher`)
- Student submission with metadata: `title`, `abstract`, `authors`, `keywords`, `strand`, `category`, `year`, PDF file
- Teacher review queue with actions: comment, suggest edits, approve, reject
- Automatic notifications:
  - Teachers are notified for new `pending` submissions
  - Students are notified after review status updates
- Researcher portal to browse/search approved research metadata; file access is reserved for authorized school users
- Admin portal for:
  - user account role management
  - research category / strand / track management
  - dashboard metrics (`total users`, `total submissions`, `pending approvals`, `approved research`)
  - rejected-record cleanup and JSON backup export
- Shared UI feedback layer with global toast notifications for success, error, warning, and info events

## Architecture

The frontend follows a clean modular structure:

- `src/app`: app shell, routing, providers
- `src/application`: use-cases
- `src/domain`: entities
- `src/infrastructure`: Supabase/Axios clients and repositories
- `src/presentation`: layouts, routes, pages, and UI components
- `src/core`: shared config/constants/utilities

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
3. Fill `.env` values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET` (default: `research-files`)
   - Optional: `VITE_SCHOOL_HERO_IMAGE` (original campus photo path), `VITE_SCHOOL_CONTACT_EMAIL` (verified school contact)
4. For a new database, initialize [`supabase/schema.sql`](supabase/schema.sql), then apply [the workflow migration](supabase/migrations/202609050001_research_workflow.sql). Review the base schema's seeded account before use. Existing databases use only the new migration after schema inspection.
5. Start dev server:
   ```bash
   npm run dev
   ```

## Supabase Notes

- Schema includes:
  - `profiles`
  - `researches`
  - `research_comments`
  - `notifications`
  - `research_categories`
  - `strands`
  - `tracks`
- RLS policies are included for student, teacher, admin, and researcher scopes.
- Storage bucket `research-files` is configured for PDF files and role-aware access control.
- Triggers auto-create notifications for teacher submission alerts and student review updates.

## Vercel Deployment

1. Import the project into Vercel.
2. Set build command: `npm run build`.
3. Set output directory: `dist`.
4. Add environment variables from `.env.example` to Vercel project settings.
5. Deploy.
