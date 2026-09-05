import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 create table public.profiles(id uuid primary key,email text,role text,full_name text);
 create table public.researches(id uuid primary key default gen_random_uuid(),student_id uuid references profiles(id),title text,abstract text,authors text[],keywords text[],strand text,category text,year integer,status text default 'pending',file_path text not null,file_url text,submitted_at timestamptz default now(),reviewed_at timestamptz,updated_at timestamptz default now());
 create table public.research_comments(id uuid primary key default gen_random_uuid(),research_id uuid references researches(id) on delete cascade,author_id uuid,comment text,suggestion text,created_at timestamptz default now());
 create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,research_id uuid references researches(id) on delete cascade,message text,is_read boolean default false,created_at timestamptz default now());
 create table public.strands(id uuid default gen_random_uuid(),name text); create table public.research_categories(id uuid default gen_random_uuid(),name text);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table profiles enable row level security;alter table researches enable row level security;alter table research_comments enable row level security;alter table storage.objects enable row level security;
 create function public.current_user_role() returns text language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() $$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant all on all tables in schema public to authenticated;
 grant all on storage.objects to authenticated;
 insert into strands(name) values('STEM');insert into research_categories(name) values('Applied Research');
 `);
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/202609050001_research_workflow.sql', import.meta.url),
      'utf8'
    )
  );
  return db;
}
