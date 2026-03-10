import { hasSupabaseConfig } from '../../core/config/env';
import { supabase } from '../supabase/supabaseClient';

function ensureSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase environment variables are missing.');
  }

  return supabase;
}

function normalizeError(error, fallbackMessage) {
  return new Error(error?.message || fallbackMessage);
}

function isMissingTrackColumnError(error) {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();
  return code === '42703' || message.includes('track');
}

async function countRows(queryBuilder, fallbackMessage) {
  const { count, error } = await queryBuilder;

  if (error) {
    throw normalizeError(error, fallbackMessage);
  }

  return count ?? 0;
}

export async function getAdminDashboardStatsRepository() {
  const client = ensureSupabase();

  const [totalUsers, totalResearchSubmissions, pendingApprovals, approvedResearch] = await Promise.all([
    countRows(client.from('profiles').select('*', { count: 'exact', head: true }), 'Unable to load user count.'),
    countRows(
      client.from('researches').select('*', { count: 'exact', head: true }),
      'Unable to load research submission count.'
    ),
    countRows(
      client
        .from('researches')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'needs_revision']),
      'Unable to load pending approvals count.'
    ),
    countRows(
      client.from('researches').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      'Unable to load approved research count.'
    )
  ]);

  return {
    totalUsers,
    totalResearchSubmissions,
    pendingApprovals,
    approvedResearch
  };
}

export async function listUsersRepository() {
  const client = ensureSupabase();
  const queryWithTrack = await client
    .from('profiles')
    .select('id,email,full_name,role,track,created_at')
    .order('created_at', { ascending: false });

  if (!queryWithTrack.error) {
    return queryWithTrack.data ?? [];
  }

  if (!isMissingTrackColumnError(queryWithTrack.error)) {
    throw normalizeError(queryWithTrack.error, 'Unable to load users.');
  }

  const fallbackQuery = await client
    .from('profiles')
    .select('id,email,full_name,role,created_at')
    .order('created_at', { ascending: false });

  if (fallbackQuery.error) {
    throw normalizeError(fallbackQuery.error, 'Unable to load users.');
  }

  return (fallbackQuery.data ?? []).map((entry) => ({ ...entry, track: null }));
}

export async function createUserRepository({ fullName, email, role, password, strand }) {
  const client = ensureSupabase();
  const { data, error } = await client.rpc('admin_create_user_account', {
    p_full_name: fullName?.trim() || null,
    p_email: email?.trim().toLowerCase() || '',
    p_role: role,
    p_password: password,
    p_strand: strand?.trim() || null
  });

  if (error) {
    throw normalizeError(error, 'Unable to create user account.');
  }

  return data;
}

export async function deleteUserRepository(userId) {
  const client = ensureSupabase();
  const { error } = await client.rpc('admin_delete_user_account', {
    p_user_id: userId
  });

  if (error) {
    throw normalizeError(error, 'Unable to delete user account.');
  }
}

export async function updateUserPasswordRepository({ userId, newPassword }) {
  const client = ensureSupabase();
  const { error } = await client.rpc('admin_update_user_password', {
    p_user_id: userId,
    p_new_password: newPassword
  });

  if (error) {
    throw normalizeError(error, 'Unable to update user password.');
  }
}

export async function updateUserRepository({ userId, role, fullName, track }) {
  const client = ensureSupabase();
  const payload = {
    role,
    full_name: fullName?.trim() || null,
    track: track?.trim() || null
  };

  const updateWithTrack = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id,email,full_name,role,track,created_at')
    .single();

  if (!updateWithTrack.error) {
    return updateWithTrack.data;
  }

  if (!isMissingTrackColumnError(updateWithTrack.error)) {
    throw normalizeError(updateWithTrack.error, 'Unable to update user account.');
  }

  const fallbackPayload = {
    role,
    full_name: fullName?.trim() || null
  };

  const fallbackUpdate = await client
    .from('profiles')
    .update(fallbackPayload)
    .eq('id', userId)
    .select('id,email,full_name,role,created_at')
    .single();

  if (fallbackUpdate.error) {
    throw normalizeError(fallbackUpdate.error, 'Unable to update user account.');
  }

  return {
    ...fallbackUpdate.data,
    track: null
  };
}

export async function listResearchCategoriesRepository() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('research_categories')
    .select('id,name,created_at')
    .order('name', { ascending: true });

  if (error) {
    throw normalizeError(error, 'Unable to load research categories.');
  }

  return data ?? [];
}

export async function createResearchCategoryRepository({ name }) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('research_categories')
    .insert({ name })
    .select('id,name,created_at')
    .single();

  if (error) {
    throw normalizeError(error, 'Unable to create research category.');
  }

  return data;
}

export async function deleteResearchCategoryRepository(id) {
  const client = ensureSupabase();
  const { error } = await client.from('research_categories').delete().eq('id', id);

  if (error) {
    throw normalizeError(error, 'Unable to delete research category.');
  }
}

export async function listStrandsRepository() {
  const client = ensureSupabase();
  const { data, error } = await client.from('strands').select('id,name,created_at').order('name');

  if (error) {
    throw normalizeError(error, 'Unable to load strands.');
  }

  return data ?? [];
}

export async function createStrandRepository({ name }) {
  const client = ensureSupabase();
  const { data, error } = await client.from('strands').insert({ name }).select('id,name,created_at').single();

  if (error) {
    throw normalizeError(error, 'Unable to create strand.');
  }

  return data;
}

export async function deleteStrandRepository(id) {
  const client = ensureSupabase();
  const { error } = await client.from('strands').delete().eq('id', id);

  if (error) {
    throw normalizeError(error, 'Unable to delete strand.');
  }
}

export async function listTracksRepository() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('tracks')
    .select(
      `
      id,
      name,
      strand_id,
      created_at,
      strands (
        id,
        name
      )
    `
    )
    .order('name');

  if (error) {
    throw normalizeError(error, 'Unable to load tracks.');
  }

  return data ?? [];
}

export async function createTrackRepository({ name, strandId }) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('tracks')
    .insert({
      name,
      strand_id: strandId || null
    })
    .select(
      `
      id,
      name,
      strand_id,
      created_at,
      strands (
        id,
        name
      )
    `
    )
    .single();

  if (error) {
    throw normalizeError(error, 'Unable to create track.');
  }

  return data;
}

export async function deleteTrackRepository(id) {
  const client = ensureSupabase();
  const { error } = await client.from('tracks').delete().eq('id', id);

  if (error) {
    throw normalizeError(error, 'Unable to delete track.');
  }
}

export async function cleanRejectedResearchRecordsRepository({ olderThanDays }) {
  const client = ensureSupabase();
  const days = Number(olderThanDays);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('researches')
    .delete()
    .eq('status', 'rejected')
    .lt('submitted_at', cutoffDate)
    .select('id');

  if (error) {
    throw normalizeError(error, 'Unable to clean rejected research records.');
  }

  return {
    deletedCount: data?.length ?? 0,
    cutoffDate
  };
}

export async function exportBackupRepository() {
  const client = ensureSupabase();

  const [
    profilesResult,
    researchesResult,
    commentsResult,
    notificationsResult,
    categoriesResult,
    strandsResult,
    tracksResult
  ] = await Promise.all([
    client.from('profiles').select('id,email,full_name,role,created_at').order('created_at'),
    client
      .from('researches')
      .select(
        'id,student_id,title,abstract,authors,keywords,strand,category,year,status,file_path,file_url,submitted_at,reviewed_at,created_at,updated_at'
      )
      .order('submitted_at'),
    client.from('research_comments').select('id,research_id,author_id,comment,suggestion,created_at').order('created_at'),
    client.from('notifications').select('id,user_id,research_id,message,is_read,created_at').order('created_at'),
    client.from('research_categories').select('id,name,created_at').order('name'),
    client.from('strands').select('id,name,created_at').order('name'),
    client.from('tracks').select('id,name,strand_id,created_at').order('name')
  ]);

  const errors = [
    profilesResult.error,
    researchesResult.error,
    commentsResult.error,
    notificationsResult.error,
    categoriesResult.error,
    strandsResult.error,
    tracksResult.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw normalizeError(errors[0], 'Unable to export backup.');
  }

  return {
    exportedAt: new Date().toISOString(),
    tables: {
      profiles: profilesResult.data ?? [],
      researches: researchesResult.data ?? [],
      research_comments: commentsResult.data ?? [],
      notifications: notificationsResult.data ?? [],
      research_categories: categoriesResult.data ?? [],
      strands: strandsResult.data ?? [],
      tracks: tracksResult.data ?? []
    }
  };
}
