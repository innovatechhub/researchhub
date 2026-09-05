import { hasSupabaseConfig } from '../../core/config/env';
import { supabase } from '../../infrastructure/supabase/supabaseClient';

function ensureSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase environment variables are missing.');
  }

  return supabase;
}

async function ensureProfileExists(userId) {
  const client = ensureSupabase();

  const { error } = await client.from('profiles').upsert(
    {
      id: userId,
      role: 'student'
    },
    {
      onConflict: 'id',
      ignoreDuplicates: true
    }
  );

  if (error && error.code !== '42P01') {
    throw error;
  }
}

export async function signInUseCase({ email, password }) {
  const client = ensureSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpUseCase({ email, password }) {
  const client = ensureSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'student'
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutUseCase() {
  const client = ensureSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getUserProfileUseCase(userId) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, role, full_name, track')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Your school account profile is unavailable. Contact the administrator.');
  }

  return data;
}
