import { beforeAll, afterAll, it, expect } from 'vitest';
import { createDatabase } from './database-fixture.mjs';
let db, rid, doc, chapters;
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  student: '00000000-0000-4000-8000-000000000002',
  teacher: '00000000-0000-4000-8000-000000000003',
  other: '00000000-0000-4000-8000-000000000004',
  researcher: '00000000-0000-4000-8000-000000000005'
};
async function login(role) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[role] || '']);
  await db.exec(`set role ${role === 'anon' ? 'anon' : 'authenticated'}`);
}
async function rpc(name, ...args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) result`,
      args
    )
  ).rows[0].result;
}
beforeAll(async () => {
  db = await createDatabase();
  for (const [role, id] of Object.entries(ids))
    await db.query('insert into profiles(id,role,full_name) values($1,$2,$3)', [
      id,
      role === 'other' ? 'teacher' : role,
      role
    ]);
});
afterAll(async () => {
  await db?.close();
});
it('denies student role escalation and privileged helper invocation', async () => {
  await login('student');
  expect(
    (await db.query("update profiles set role='admin' where id=$1 returning id", [ids.student]))
      .rows
  ).toHaveLength(0);
  await expect(rpc('workflow_assign', ids.teacher, ids.student, '2026', true)).rejects.toThrow(
    'Administrator'
  );
  await expect(rpc('workflow_notify', ids.student, null, 'forged', null)).rejects.toThrow(
    'permission denied'
  );
});
it('requires an eligible teacher and creates a private draft with a chapter template', async () => {
  const metadata = JSON.stringify({
    title: 'Research test',
    abstract: 'Test abstract',
    authors: ['Student'],
    keywords: [],
    strand: 'STEM',
    category: 'Applied Research',
    year: 2026
  });
  await expect(rpc('workflow_create', metadata, ids.teacher)).rejects.toThrow('assigned teacher');
  await login('admin');
  await rpc('workflow_assign', ids.teacher, ids.student, '2026', true);
  await login('student');
  rid = await rpc('workflow_create', metadata, ids.teacher);
  chapters = (
    await db.query('select * from research_chapters where research_id=$1 order by position', [rid])
  ).rows;
  expect(chapters).toHaveLength(5);
  await login('other');
  expect((await db.query('select * from researches where id=$1', [rid])).rows).toHaveLength(0);
  expect((await db.query('select * from research_chapters')).rows).toHaveLength(0);
  await login('teacher');
  expect((await db.query('select * from researches where id=$1', [rid])).rows).toHaveLength(1);
});
it('persists extraction and submits versioned chapters without publishing the source', async () => {
  await login('student');
  const path = `${ids.student}/${rid}/test.pdf`;
  await db.query("insert into storage.objects(bucket_id,name) values('research-files',$1)", [path]);
  doc = await rpc('workflow_register_document', rid, path, 'pdf', 'checksum');
  await rpc('workflow_process', doc, 'processing', null, null);
  await rpc(
    'workflow_process',
    doc,
    'ready',
    JSON.stringify({
      blocks: Array.from({ length: 5 }, (_, i) => ({ text: `Chapter ${i + 1} body` })),
      chapters: [],
      unit: 'page'
    }),
    null
  );
  await expect(
    rpc(
      'workflow_save_chapters',
      rid,
      doc,
      JSON.stringify([
        { chapter_id: chapters[0].id, expected_version: null, start_block: 0, end_block: 2 },
        { chapter_id: chapters[1].id, expected_version: null, start_block: 1, end_block: 3 }
      ]),
      true
    )
  ).rejects.toThrow('overlap');
  await rpc(
    'workflow_save_chapters',
    rid,
    doc,
    JSON.stringify(
      chapters.map((c, i) => ({
        chapter_id: c.id,
        expected_version: null,
        start_block: i,
        end_block: i
      }))
    ),
    true
  );
  const versions = (await db.query('select * from chapter_versions')).rows;
  expect(versions).toHaveLength(5);
  expect(versions.every((v) => v.status === 'submitted')).toBe(true);
  await login('researcher');
  expect((await db.query('select * from chapter_versions')).rows).toHaveLength(0);
  expect((await db.query('select * from storage.objects')).rows).toHaveLength(0);
});
it('requires all chapters approved, keeps submitted work out of overdue totals, and deduplicates reminders', async () => {
  await login('teacher');
  await expect(rpc('workflow_publish', rid, doc)).rejects.toThrow('All required chapters');
  await rpc('workflow_deadline', chapters[0].id, '2020-01-01T00:00:00Z', 'Initial deadline');
  const progress = await rpc('workflow_progress');
  expect(progress[0].awaiting_count).toBe(5);
  expect(progress[0].overdue_count).toBe(0);
  const versions = (await db.query('select * from chapter_versions')).rows;
  for (const v of versions) await rpc('workflow_review', v.id, 'approved', 'Good work');
  await expect(rpc('workflow_review', versions[0].id, 'approved', 'again')).rejects.toThrow(
    'already been reviewed'
  );
  await rpc('workflow_publish', rid, doc);
  await login('admin');
  await rpc('workflow_preview', rid, true);
  await login('anon');
  expect((await db.query('select * from public_research_previews')).rows).toHaveLength(1);
  await expect(db.query('select * from chapter_versions')).rejects.toThrow('permission denied');
});
it('keeps published research visible during revisions, rejects stale reviews, and revokes old teacher access', async () => {
  await login('student');
  const current = (
    await db.query('select * from chapter_versions where chapter_id=$1', [chapters[0].id])
  ).rows[0];
  await rpc(
    'workflow_save_chapters',
    rid,
    doc,
    JSON.stringify([
      { chapter_id: chapters[0].id, expected_version: current.id, start_block: 0, end_block: 0 }
    ]),
    false
  );
  await expect(
    rpc(
      'workflow_save_chapters',
      rid,
      doc,
      JSON.stringify([
        { chapter_id: chapters[0].id, expected_version: current.id, start_block: 0, end_block: 0 }
      ]),
      true
    )
  ).rejects.toThrow('changed');
  await login('teacher');
  await expect(rpc('workflow_review', current.id, 'feedback', 'old')).rejects.toThrow('current');
  expect((await rpc('workflow_progress'))[0].overdue_count).toBe(1);
  await db.exec('reset role');
  expect(await rpc('workflow_reminders')).toBe(1);
  expect(await rpc('workflow_reminders')).toBe(0);
  await login('admin');
  await rpc('workflow_assign', ids.other, ids.student, '2026', true);
  await rpc('workflow_reassign', rid, ids.other, 'New adviser');
  await login('teacher');
  expect((await db.query('select * from chapter_versions')).rows).toHaveLength(0);
  await login('anon');
  expect((await db.query('select * from public_research_previews')).rows).toHaveLength(1);
});
it('queues every original file before relational cleanup and removes public previews', async () => {
  await login('admin');
  await db.query('delete from researches where id=$1', [rid]);
  expect((await db.query('select * from research_chapters')).rows).toHaveLength(0);
  expect((await db.query('select * from chapter_versions')).rows).toHaveLength(0);
  expect((await db.query('select * from storage_cleanup_queue')).rows).toHaveLength(1);
  await login('anon');
  expect((await db.query('select * from public_research_previews')).rows).toHaveLength(0);
});
