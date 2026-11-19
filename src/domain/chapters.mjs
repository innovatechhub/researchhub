export const DEFAULT_TITLES = [
  'Introduction',
  'Review of Related Literature',
  'Methodology',
  'Results and Discussion',
  'Summary, Conclusions, and Recommendations'
];
const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
export function detectChapters(blocks, titles = DEFAULT_TITLES) {
  const candidates = [];
  blocks.forEach((block, index) => {
    const text = block.text.trim();
    if (
      text.length > 220 ||
      /\.{3,}|\s\d+\s*$/.test(text.replace(/^chapter\s+(\d+|[ivx]+)\s*$/i, ''))
    )
      return;
    const match = text.match(/^chapter\s+(\d{1,2}|[ivx]+)(?:\s*[:.\-–—]?\s*(.*))?$/i);
    const position = match
      ? Number(match[1]) || roman[match[1].toUpperCase()]
      : titles.findIndex((title) => title.toLowerCase() === text.toLowerCase()) + 1;
    if (position > 0 && position <= titles.length)
      candidates.push({ position, start_block: index });
  });
  // Contents headings occur close together with little body text. Prefer the last substantial occurrence.
  const grouped = candidates.filter(
    (candidate, i) =>
      !(
        i > 0 &&
        candidate.position === candidates[i - 1].position &&
        candidate.start_block - candidates[i - 1].start_block <= 2
      )
  );
  const selected = new Map();
  grouped.forEach((candidate, i) => {
    const next = grouped[i + 1]?.start_block ?? blocks.length;
    const body = blocks
      .slice(candidate.start_block, next)
      .map((b) => b.sourceText || b.text)
      .join(' ');
    const existing = selected.get(candidate.position);
    if (!existing || (!existing.substantial && body.length > 100))
      selected.set(candidate.position, { ...candidate, substantial: body.length > 100 });
  });
  const ordered = [...selected.values()].sort((a, b) => a.start_block - b.start_block);
  return ordered.map((chapter, i) => {
    let end = (ordered[i + 1]?.start_block ?? blocks.length) - 1;
    for (let j = chapter.start_block + 1; j <= end; j++) {
      if (/^(references|bibliography|appendix|appendices)\s*[a-z]?$/i.test(blocks[j].text.trim())) {
        end = j - 1;
        break;
      }
    }
    return {
      position: chapter.position,
      title: titles[chapter.position - 1],
      start_block: chapter.start_block,
      end_block: end
    };
  });
}
export function validateRanges(chapters, blockCount) {
  const sorted = [...chapters].sort((a, b) => a.start_block - b.start_block);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (
      !Number.isInteger(c.start_block) ||
      !Number.isInteger(c.end_block) ||
      c.start_block < 0 ||
      c.end_block < c.start_block ||
      c.end_block >= blockCount
    )
      throw new Error('Chapter boundaries must be within the document.');
    if (i && sorted[i - 1].end_block >= c.start_block)
      throw new Error('Chapter ranges must not overlap.');
  }
  return chapters;
}
export function completion(row) {
  return Number(row.required_count)
    ? Math.round((Number(row.approved_count) / Number(row.required_count)) * 100)
    : null;
}
export function schoolDate(value) {
  return value
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Manila'
      }).format(new Date(value))
    : 'No deadline';
}
export function schoolInput(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Manila'
  }).format(new Date(value));
  return parts.replace(' ', 'T');
}
export function schoolToUTC(value) {
  return value ? new Date(`${value}:00+08:00`).toISOString() : null;
}
export function csvCell(value) {
  const text = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
}
// Standard sections per chapter position. Teachers tag corrections with one of these.
export const SECTION_TITLES = {
  1: [
    'Background of the Study',
    'Statement of the Problem',
    'Objectives of the Study',
    'Significance of the Study',
    'Scope and Delimitation'
  ],
  2: [
    'Related Literature',
    'Related Studies',
    'Synthesis of the Reviewed Literature',
    'Conceptual Framework'
  ],
  3: [
    'Research Design',
    'Respondents of the Study',
    'Research Instrument',
    'Data Gathering Procedure',
    'Statistical Treatment of Data'
  ],
  4: ['Presentation of Data', 'Analysis of Data', 'Interpretation of Results'],
  5: ['Summary of Findings', 'Conclusions', 'Recommendations']
};
const normalizeHeading = (text) =>
  text
    .toLowerCase()
    .replace(/^\s*(\d+|[ivx]+)[.):\-\s]+/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
// Splits chapter text into sections when a section title appears alone on a line. A section whose
// heading is not found has content null, so callers can fall back to the whole chapter.
export function splitSections(content, titles = []) {
  const lines = String(content || '').split(/\r?\n/);
  const heads = [];
  titles.forEach((title) => {
    const wanted = normalizeHeading(title);
    const at = lines.findIndex(
      (line, i) =>
        line.trim().length <= 120 &&
        normalizeHeading(line) === wanted &&
        !heads.some((h) => h.line === i)
    );
    if (at >= 0) heads.push({ title, line: at });
  });
  heads.sort((a, b) => a.line - b.line);
  return titles.map((title) => {
    const index = heads.findIndex((h) => h.title === title);
    if (index < 0) return { title, content: null };
    const end = heads[index + 1]?.line ?? lines.length;
    return {
      title,
      content: lines
        .slice(heads[index].line + 1, end)
        .join('\n')
        .trim()
    };
  });
}
// All reviews for a chapter across every version, newest first, each labelled with its version.
// Earlier feedback stays visible after the student submits a new version.
export function chapterFeedback(reviews, versions, chapterId) {
  const byVersion = new Map(
    versions.filter((v) => v.chapter_id === chapterId).map((v) => [v.id, v])
  );
  return reviews
    .filter((r) => byVersion.has(r.version_id))
    .map((r) => ({ ...r, version_number: byVersion.get(r.version_id).version_number }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
// Correction = a revision request or any tagged-severity feedback; Remark = plain feedback.
export function feedbackKind(review) {
  if (review.decision === 'approved') return 'approved';
  return review.decision === 'needs_revision' || review.severity ? 'correction' : 'remark';
}
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Pending Review',
  needs_revision: 'For Revision',
  approved: 'Approved',
  rejected: 'Rejected',
  none: 'Not Yet Submitted'
};
