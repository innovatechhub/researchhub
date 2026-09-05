import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell. Never use a VITE_ variable for the service key.'
  );
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const destination = resolve(
  process.argv[2] || `backups/researchhub-${new Date().toISOString().replaceAll(':', '-')}`
);
await mkdir(destination, { recursive: false });
await mkdir(join(destination, 'objects'));
const tables = [
  'profiles',
  'researches',
  'research_comments',
  'notifications',
  'research_categories',
  'strands',
  'tracks',
  'teacher_student_assignments',
  'research_assignment_history',
  'workflow_settings',
  'research_documents',
  'document_processing_jobs',
  'research_chapters',
  'chapter_versions',
  'chapter_reviews',
  'chapter_deadlines',
  'chapter_deadline_history',
  'public_research_previews',
  'storage_cleanup_queue'
];
const snapshot = { exportedAt: new Date().toISOString(), tables: {}, files: [], complete: false };
for (const table of tables) {
  const records = [];
  let start = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(
        table === 'storage_cleanup_queue'
          ? 'file_path'
          : table === 'chapter_deadlines'
            ? 'chapter_id'
            : table === 'public_research_previews'
              ? 'research_id'
              : 'id'
      )
      .range(start, start + 499);
    if (error) throw error;
    records.push(...data);
    if (data.length < 500) break;
    start += 500;
  }
  snapshot.tables[table] = records;
}
const paths = [
  ...new Set(
    [
      ...snapshot.tables.researches.map((r) => r.file_path),
      ...snapshot.tables.research_documents.map((d) => d.file_path)
    ].filter(Boolean)
  )
];
for (const path of paths) {
  const { data, error } = await client.storage.from('research-files').download(path);
  if (error) throw error;
  const bytes = Buffer.from(await data.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const filename = `${snapshot.files.length.toString().padStart(6, '0')}.bin`;
  await writeFile(join(destination, 'objects', filename), bytes);
  snapshot.files.push({
    storagePath: path,
    localPath: `objects/${filename}`,
    sha256: checksum,
    contentType: data.type,
    bytes: bytes.length
  });
}
snapshot.complete = true;
await writeFile(join(destination, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
console.log(
  `Exported ${tables.length} tables and ${paths.length} original files to ${destination}`
);
console.log(
  'Use a PostgreSQL/Supabase database backup as well to preserve schema, auth accounts, and a consistent point-in-time snapshot.'
);
