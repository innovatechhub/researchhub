const readEnv = (name, fallback = '') => (import.meta.env[name] ?? fallback).trim();

export const env = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  storageBucket: readEnv('VITE_SUPABASE_STORAGE_BUCKET', 'research-files')
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabaseAnonKey);
