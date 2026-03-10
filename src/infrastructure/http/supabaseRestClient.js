import axios from 'axios';
import { env, hasSupabaseConfig } from '../../core/config/env';

export function createSupabaseRestClient(accessToken) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase environment variables are missing.');
  }

  if (!accessToken) {
    throw new Error('Missing access token for authenticated Supabase REST request.');
  }

  return axios.create({
    baseURL: `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1`,
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });
}
