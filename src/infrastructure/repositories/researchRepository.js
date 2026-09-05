import { env, hasSupabaseConfig } from '../../core/config/env';
import { supabase } from '../supabase/supabaseClient';

const BASE_RESEARCH_SELECT_FIELDS = `
  id,
  student_id,
  teacher_id,
  workflow_enabled,
  title,
  abstract,
  authors,
  keywords,
  strand,
  category,
  year,
  status,
  file_path,
  file_url,
  submitted_at,
  reviewed_at,
  updated_at
`;

const RESEARCH_WITH_COMMENTS_SELECT_FIELDS = `
  ${BASE_RESEARCH_SELECT_FIELDS},
  research_comments (
    id,
    author_id,
    comment,
    suggestion,
    created_at
  )
`;

const sanitizeFileName = (fileName) => fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

function ensureSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase environment variables are missing.');
  }

  return supabase;
}

export async function submitResearchRepository({
  studentId,
  title,
  abstract,
  authors,
  keywords,
  strand,
  category,
  year,
  file
}) {
  const client = ensureSupabase();
  const safeName = sanitizeFileName(file.name);
  const filePath = `${studentId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await client.storage
    .from(env.storageBucket)
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await client
    .from('researches')
    .insert({
      student_id: studentId,
      title,
      abstract,
      authors,
      strand,
      category,
      year,
      keywords,
      file_path: filePath,
      file_url: null,
      status: 'pending'
    })
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listStudentResearchesRepository(studentId) {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('researches')
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listTeacherResearchQueueRepository() {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('researches')
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .in('status', ['pending', 'needs_revision'])
    .order('submitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listAllResearchesRepository() {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('researches')
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function addResearchCommentRepository({ researchId, authorId, comment, suggestion }) {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('research_comments')
    .insert({
      research_id: researchId,
      author_id: authorId,
      comment,
      suggestion: suggestion || null
    })
    .select('id,research_id,author_id,comment,suggestion,created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateResearchStatusRepository({ researchId, status }) {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('researches')
    .update({ status })
    .eq('id', researchId)
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listApprovedResearchesRepository() {
  const client = ensureSupabase();

  const { data, error } = await client
    .from('researches')
    .select(RESEARCH_WITH_COMMENTS_SELECT_FIELDS)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .order('submitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getResearchFileDownloadUrlRepository(filePath) {
  const client = ensureSupabase();

  const { data, error } = await client.storage
    .from(env.storageBucket)
    .createSignedUrl(filePath, 300);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
