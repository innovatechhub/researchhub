import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseConfig } from '../../core/config/env';

export const supabase = hasSupabaseConfig
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
