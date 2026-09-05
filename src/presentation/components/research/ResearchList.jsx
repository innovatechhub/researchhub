import { formatDate } from '../../../core/utils/date';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  needs_revision: 'bg-sky-100 text-sky-800'
};

export function ResearchList({ researches, onOpenFile, fileLoadingId }) {
  const { role } = useAuth();
  if (researches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        No research submissions yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {researches.map((research) => (
        <article className="rounded-2xl bg-white p-5 shadow-card" key={research.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{research.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                Submitted on {formatDate(research.submittedAt)}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[research.status] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {research.status.replace('_', ' ')}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-700">{research.abstract}</p>

          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-slate-700">Authors:</span>{' '}
              {research.authors.length > 0 ? research.authors.join(', ') : 'N/A'}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Year:</span> {research.year ?? 'N/A'}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Strand:</span>{' '}
              {research.strand || 'N/A'}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Category:</span>{' '}
              {research.category || 'N/A'}
            </p>
          </div>

          {research.keywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {research.keywords.map((keyword) => (
                <span
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                  key={`${research.id}-${keyword}`}
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {role !== 'researcher' && (
              <Link
                className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white"
                to={`/${role}/research/${research.id}`}
              >
                Open chapter workspace
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              disabled={fileLoadingId === research.id || !research.filePath}
              onClick={() => onOpenFile(research)}
            >
              {fileLoadingId === research.id
                ? 'Preparing file...'
                : research.filePath
                  ? 'Open posted/original file'
                  : 'Manuscripts in workspace'}
            </button>
          </div>

          <section className="mt-5 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Comments and Suggestions</h4>
            {research.comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet.</p>
            ) : (
              research.comments.map((comment) => (
                <div className="rounded-xl bg-slate-50 p-3" key={comment.id}>
                  <p className="text-sm text-slate-800">{comment.comment}</p>
                  {comment.suggestion ? (
                    <p className="mt-2 text-xs text-slate-600">Suggestion: {comment.suggestion}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">{formatDate(comment.createdAt)}</p>
                </div>
              ))
            )}
          </section>
        </article>
      ))}
    </div>
  );
}
