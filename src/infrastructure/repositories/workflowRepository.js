import { supabase } from '../supabase/supabaseClient';
import { env } from '../../core/config/env';
import { validateRanges } from '../../domain/chapters.mjs';

export function workflowClient() {
  if (!supabase)
    throw new Error('The repository connection is not configured. Contact the administrator.');
  return supabase;
}
export async function rpc(name, parameters = {}) {
  const { data, error } = await workflowClient().rpc(name, parameters);
  if (error) throw new Error(error.message);
  return data;
}
export async function rows(table, configure = (q) => q) {
  const { data, error } = await configure(workflowClient().from(table).select('*'));
  if (error) throw new Error(error.message);
  return data || [];
}
export async function loadWorkspace(id) {
  const [researches, chapters, documents, directory] = await Promise.all([
    rows('researches', (q) => q.eq('id', id)),
    rows('research_chapters', (q) => q.eq('research_id', id).order('position')),
    rows('research_documents', (q) =>
      q.eq('research_id', id).order('created_at', { ascending: false })
    ),
    rpc('workflow_directory')
  ]);
  if (!researches.length) throw new Error('Research not found or access is unavailable.');
  const ids = chapters.map((c) => c.id);
  const versions = ids.length
    ? await rows('chapter_versions', (q) =>
        q.in('chapter_id', ids).order('version_number', { ascending: false })
      )
    : [];
  const [reviews, deadlines, jobs, deadlineHistory] = await Promise.all([
    versions.length
      ? rows('chapter_reviews', (q) =>
          q
            .in(
              'version_id',
              versions.map((v) => v.id)
            )
            .order('created_at', { ascending: false })
        )
      : [],
    ids.length ? rows('chapter_deadlines', (q) => q.in('chapter_id', ids)) : [],
    documents.length
      ? rows('document_processing_jobs', (q) =>
          q.in(
            'document_id',
            documents.map((d) => d.id)
          )
        )
      : [],
    ids.length
      ? rows('chapter_deadline_history', (q) =>
          q.in('chapter_id', ids).order('created_at', { ascending: false })
        )
      : []
  ]);
  return {
    research: researches[0],
    chapters,
    documents,
    directory,
    versions,
    reviews,
    deadlines,
    jobs,
    deadlineHistory
  };
}
export async function uploadDocument(researchId, file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx'].includes(extension))
    throw new Error('Convert older DOC files to PDF or DOCX before uploading.');
  if (!file.size || file.size > 50 * 1024 * 1024)
    throw new Error('Choose a nonempty file up to 50 MiB.');
  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes.slice(0, 5));
  if (
    (extension === 'pdf' && String.fromCharCode(...signature) !== '%PDF-') ||
    (extension === 'docx' && (signature[0] !== 80 || signature[1] !== 75))
  )
    throw new Error('File contents do not match the selected document format.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
  const client = workflowClient();
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user) throw new Error('Sign in before uploading.');
  const path = `${user.id}/${researchId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from(env.storageBucket)
    .upload(path, file, {
      contentType:
        extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  if (error) throw new Error(error.message);
  try {
    return await rpc('workflow_register_document', {
      p_research: researchId,
      p_path: path,
      p_format: extension,
      p_checksum: checksum
    });
  } catch (error) {
    await client.storage.from(env.storageBucket).remove([path]);
    throw error;
  }
}
export async function processDocument(documentId, file, titles) {
  await rpc('workflow_process', { p_document: documentId, p_state: 'processing' });
  try {
    const { extractDocument } = await import('../documents/extractDocument');
    const result = await extractDocument(file, titles);
    await rpc('workflow_process', {
      p_document: documentId,
      p_state: result.chapters.length ? 'ready' : 'needs_input',
      p_result: result
    });
    return result;
  } catch (error) {
    await rpc('workflow_process', {
      p_document: documentId,
      p_state: 'failed',
      p_error: error.message
    }).catch(() => {});
    throw error;
  }
}
export async function retryDocument(document, titles) {
  const { data, error } = await workflowClient()
    .storage.from(env.storageBucket)
    .download(document.file_path);
  if (error) throw new Error(error.message);
  return processDocument(
    document.id,
    new File([data], `manuscript.${document.format}`, { type: data.type }),
    titles
  );
}
export async function saveChapters(researchId, documentId, chapters, count, submit) {
  validateRanges(chapters, count);
  return rpc('workflow_save_chapters', {
    p_research: researchId,
    p_document: documentId,
    p_chapters: chapters,
    p_submit: submit
  });
}
export async function signedDocument(path) {
  const { data, error } = await workflowClient()
    .storage.from(env.storageBucket)
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
export async function loadReportData() {
  const [researches, activity] = await Promise.all([
    rows('researches', (q) =>
      q.select('id,title,status,strand,category,year,teacher_id,submitted_at')
    ),
    rows('activity_log', (q) => q.order('created_at', { ascending: false }).limit(200))
  ]);
  const teacherIds = [...new Set(researches.map((r) => r.teacher_id).filter(Boolean))];
  const actorIds = [...new Set(activity.map((a) => a.actor_id).filter(Boolean))];
  const profileIds = [...new Set([...teacherIds, ...actorIds])];
  const profiles = profileIds.length
    ? await rows('profiles', (q) => q.select('id,full_name').in('id', profileIds))
    : [];
  const nameById = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || 'School user']));
  return {
    researches: researches.map((r) => ({
      ...r,
      teacherName: r.teacher_id ? nameById[r.teacher_id] || 'Unknown teacher' : 'Unassigned'
    })),
    activity: activity.map((a) => ({
      ...a,
      actorName: a.actor_id ? nameById[a.actor_id] || 'Unknown user' : 'System'
    }))
  };
}
