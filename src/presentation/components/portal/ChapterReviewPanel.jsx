import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiFileText,
  FiInfo,
  FiMessageSquare
} from 'react-icons/fi';
import {
  SECTION_TITLES,
  chapterFeedback,
  feedbackKind,
  schoolDate,
  splitSections
} from '../../../domain/chapters.mjs';
import { signedDocument } from '../../../infrastructure/repositories/workflowRepository';
import { useToast } from '../../../app/providers/ToastProvider';
import { StatusBadge } from './StatusBadge';

const GENERAL = '';

export function sectionTitlesFor(chapter) {
  return SECTION_TITLES[chapter?.position] || [];
}

function FeedbackCard({ review, reviewerName }) {
  const kind = feedbackKind(review);
  const Icon = kind === 'correction' ? FiAlertCircle : kind === 'approved' ? FiCheckCircle : FiInfo;
  const title = kind === 'correction' ? 'Correction' : kind === 'approved' ? 'Approved' : 'Remark';
  return (
    <article className={`${kind}-card`}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
        <Icon aria-hidden="true" />
        {title}
        {review.severity === 'major' && (
          <span className="status-pill status-needs_revision">Major Revision</span>
        )}
        {review.severity === 'minor' && (
          <span className="status-pill status-submitted">Minor Revision</span>
        )}
      </div>
      <p className="whitespace-pre-wrap">{review.comment || 'Chapter approved.'}</p>
      <p className="mt-2 text-xs text-slate-500">
        Version {review.version_number}
        {reviewerName ? ` · ${reviewerName}` : ''} · {schoolDate(review.created_at)}
      </p>
    </article>
  );
}

// Feedback thread: every review on the chapter, across all versions, newest first.
export function FeedbackThread({ reviews, nameOf, empty }) {
  if (!reviews.length)
    return <p className="text-sm text-slate-500">{empty || 'No feedback yet.'}</p>;
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <FeedbackCard key={review.id} review={review} reviewerName={nameOf?.(review.reviewer_id)} />
      ))}
    </div>
  );
}

export function SubmittedFile({ document, label }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!document)
    return (
      <p className="text-sm text-slate-500">No manuscript file is attached to this version.</p>
    );
  const ext = document.format.toUpperCase();
  return (
    <div className="submitted-file flex min-w-0 flex-col items-center gap-2 rounded-xl bg-slate-50 p-4 text-center">
      <FiFileText aria-hidden="true" className="h-12 w-12 shrink-0 text-navy-500" />
      <p className="max-w-full break-words text-sm font-semibold text-slate-800">
        {label}.{document.format}
      </p>
      <p className="text-xs text-slate-500">
        {ext} · Uploaded {schoolDate(document.created_at)}
      </p>
      <button
        type="button"
        className="button button-navy"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            window.open(await signedDocument(document.file_path), '_blank', 'noopener,noreferrer');
          } catch (e) {
            toast.error(e.message || 'Unable to open the file.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <FiDownload aria-hidden="true" /> Download
      </button>
    </div>
  );
}

/**
 * Chapter detail shared by the teacher and student dashboards.
 * `onSectionChange` lets the teacher form follow the open section; `children` renders below
 * the accordion (the teacher's correction form).
 */
export function ChapterReviewPanel({
  data,
  chapter,
  fileLabel,
  nameOf,
  contentHeading,
  onSectionChange,
  selectedSection,
  children
}) {
  const titles = sectionTitlesFor(chapter);
  const version = data.versions.find((v) => v.id === chapter.current_version_id);
  const feedback = useMemo(
    () => chapterFeedback(data.reviews, data.versions, chapter.id),
    [data.reviews, data.versions, chapter.id]
  );
  const sections = useMemo(() => splitSections(version?.content, titles), [version, titles]);
  const notesFor = (key) =>
    feedback.filter((r) =>
      key === GENERAL ? !r.section || !titles.includes(r.section) : r.section === key
    );
  // Start on the first row that has feedback, so a correction is never hidden in a closed row.
  const firstWithNotes = () =>
    [...titles, GENERAL].find((key) => notesFor(key).length) ?? titles[0] ?? GENERAL;
  const [open, setOpen] = useState(firstWithNotes);
  useEffect(() => {
    setOpen(firstWithNotes());
  }, [chapter.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onSectionChange?.(open);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedSection != null) setOpen(selectedSection);
  }, [selectedSection]);

  const rows = [
    ...titles.map((title, i) => ({
      key: title,
      title,
      index: i + 1,
      content: sections[i]?.content
    })),
    { key: GENERAL, title: 'General feedback (whole chapter)', index: null, content: null }
  ];
  const document = data.documents.find((d) => d.id === version?.document_id);

  if (!version)
    return (
      <div className="card-pane">
        <div className="card-pane-head">
          Chapter {chapter.position} – {chapter.title}
        </div>
        <p className="empty-panel">This chapter has not been submitted yet.</p>
        {children}
      </div>
    );

  return (
    <div className="chapter-review-panel min-w-0 space-y-2">
      <div className="card-pane-head rounded-xl">
        <FiFileText aria-hidden="true" />
        Chapter {chapter.position} – {chapter.title}
        <StatusBadge status={version.status} className="ml-auto" />
      </div>
      <div
        className="chapter-review-scroll"
        role="region"
        aria-label="Chapter sections and corrections"
        tabIndex={0}
      >
        {rows.map((row) => {
          const isOpen = open === row.key;
          const mine = notesFor(row.key);
          return (
            <section key={row.key || 'general'} className="card-pane">
              <button
                type="button"
                aria-expanded={isOpen}
                className="section-toggle flex w-full items-center gap-3 bg-navy-100 px-3 py-2.5 text-left font-bold text-navy-900"
                onClick={() => setOpen(isOpen && !children ? null : row.key)}
              >
                <FiFileText aria-hidden="true" />
                <span className="flex-1">
                  {row.index ? `${row.index}. ` : ''}
                  {row.title}
                </span>
                {mine.length > 0 && (
                  <span className="status-pill status-needs_revision">
                    {mine.length} {mine.length === 1 ? 'note' : 'notes'}
                  </span>
                )}
                {isOpen ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
              </button>
              {isOpen && (
                <div className="dash-columns p-3">
                  <div className="min-w-0 space-y-3">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800">
                      <FiFileText aria-hidden="true" /> {contentHeading || 'Submitted content'}
                    </h3>
                    {row.key === GENERAL ? (
                      <>
                        {version.content && (
                          <div className="chapter-content section-content">{version.content}</div>
                        )}
                        <SubmittedFile document={document} label={fileLabel} />
                      </>
                    ) : row.content ? (
                      <div className="chapter-content section-content">{row.content}</div>
                    ) : (
                      <p className="notice">
                        This manuscript does not have separate text for this section. Open the full
                        chapter text below or download the original manuscript.
                      </p>
                    )}
                    {row.key !== GENERAL && <SubmittedFile document={document} label={fileLabel} />}
                  </div>
                  <div className="corrections-panel min-w-0 space-y-3">
                    <h3 className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 font-bold text-slate-800">
                      <FiMessageSquare aria-hidden="true" /> Teacher&apos;s Corrections
                    </h3>
                    <div
                      className="feedback-scroll"
                      role="region"
                      aria-label="Teacher feedback history"
                      tabIndex={0}
                    >
                      <FeedbackThread
                        reviews={mine}
                        nameOf={nameOf}
                        empty="No corrections for this section yet."
                      />
                    </div>
                    {children}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        <details className="card-pane">
          <summary className="cursor-pointer bg-navy-50 px-4 py-3 font-semibold text-navy-900">
            Read the full chapter text
          </summary>
          <div className="chapter-content m-4">
            {version.content ||
              'This chapter uses scanned pages. Open the original manuscript to read it.'}
          </div>
        </details>
      </div>
    </div>
  );
}

export function RevisionHistory({ data, chapter, title = 'Revision History' }) {
  const versions = data.versions
    .filter((v) => v.chapter_id === chapter.id)
    .sort((a, b) => b.version_number - a.version_number);
  return (
    <section className="card-pane">
      <h3 className="flex items-center gap-2 bg-navy-50 px-4 py-3 font-bold text-navy-900">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="report-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date Submitted</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const last = chapterFeedback(data.reviews, data.versions, chapter.id).find(
                (r) => r.version_id === v.id
              );
              return (
                <tr key={v.id}>
                  <td>
                    v{v.version_number}.0{v.version_number === 1 ? ' (Original)' : ''}
                  </td>
                  <td>{schoolDate(v.submitted_at || v.created_at)}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{last ? "See teacher's comments" : '—'}</td>
                </tr>
              );
            })}
            {!versions.length && (
              <tr>
                <td colSpan="4">Nothing submitted for this chapter yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
