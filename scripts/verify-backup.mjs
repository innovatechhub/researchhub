import { readFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
const directory = resolve(process.argv[2] || '');
const snapshot = JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8'));
if (!snapshot.complete) throw new Error('Backup is incomplete.');
for (const file of snapshot.files) {
  const path = resolve(directory, file.localPath);
  const rel = relative(directory, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid backup file path.');
  const bytes = await readFile(path);
  if (
    bytes.length !== file.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== file.sha256
  )
    throw new Error(`Checksum mismatch: ${file.localPath}`);
}
console.log(
  `Verified ${snapshot.files.length} stored objects and ${Object.keys(snapshot.tables).length} table exports.`
);
