import { supabase } from '../supabase/supabaseClient';
export async function listPublicResearch({ search = '', page = 0, limit = 9 } = {}) {
  if (!supabase) return { records: [], count: 0 };
  let query = supabase
    .from('public_research_previews')
    .select('research_id,title,authors,abstract_excerpt,category,strand,year,published_at', {
      count: 'exact'
    });
  if (search.trim()) query = query.ilike('title', `%${search.trim().replace(/[%_]/g, '')}%`);
  const { data, count, error } = await query
    .order('published_at', { ascending: false })
    .order('research_id')
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw new Error('Research previews are temporarily unavailable. Please try again.');
  return { records: data || [], count: count || 0 };
}
