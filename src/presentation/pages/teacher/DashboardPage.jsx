import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../../core/utils/date';
import {
  getResearchFileDownloadUrlUseCase,
  listTeacherResearchQueueUseCase,
  reviewResearchUseCase
} from '../../../application/usecases/researchUseCases';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  needs_revision: 'bg-sky-100 text-sky-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700'
};

export function TeacherDashboardPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');

  const loadQueue = useCallback(
    async () => {
      if (!hasSupabaseConfig || !user) {
        setLoading(false);
        return;
      }

      try {
        const records = await listTeacherResearchQueueUseCase();
        setQueue(records);
      } catch (error) {
        toast.error(error.message || 'Unable to load teacher review queue.');
      } finally {
        setLoading(false);
      }
    },
    [hasSupabaseConfig, toast, user]
  );

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleDraftChange = (researchId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [researchId]: {
        comment: current[researchId]?.comment ?? '',
        suggestion: current[researchId]?.suggestion ?? '',
        [field]: value
      }
    }));
  };

  const handleOpenFile = async (research) => {
    try {
      setFileLoadingId(research.id);
      const signedUrl = await getResearchFileDownloadUrlUseCase(research.filePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Unable to open research file.');
    } finally {
      setFileLoadingId('');
    }
  };

  const handleReview = async (research, status) => {
    const draft = drafts[research.id] ?? { comment: '', suggestion: '' };

    setActionLoadingId(research.id);

    try {
      await reviewResearchUseCase({
        teacherId: user.id,
        researchId: research.id,
        comment: draft.comment,
        suggestion: draft.suggestion,
        status
      });

      setDrafts((current) => ({
        ...current,
        [research.id]: { comment: '', suggestion: '' }
      }));

      toast.success(
        status
          ? `Review submitted. Status updated to ${status.replace('_', ' ')}.`
          : 'Comment/suggestion submitted successfully.'
      );

      await loadQueue();
    } catch (error) {
      toast.error(error.message || 'Unable to submit review action.');
    } finally {
      setActionLoadingId('');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white shadow-card">
        <p className="text-sm uppercase tracking-wide text-brand-100">Teacher Dashboard</p>
        <h2 className="mt-2 text-2xl font-bold">Review Pending Research Submissions</h2>
        <p className="mt-2 text-sm text-brand-100">
          Add comments and suggestions, then approve, reject, or request edits.
        </p>
      </section>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No pending research submissions in the review queue.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((research) => {
            const draft = drafts[research.id] ?? { comment: '', suggestion: '' };
            const busy = actionLoadingId === research.id;

            return (
              <article className="rounded-2xl bg-white p-5 shadow-card" key={research.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{research.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted on {formatDate(research.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[research.status] ?? 'bg-slate-100 text-slate-700'}`}
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

                <div className="mt-4">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    disabled={fileLoadingId === research.id}
                    onClick={() => handleOpenFile(research)}
                  >
                    {fileLoadingId === research.id ? 'Preparing file...' : 'Open uploaded file'}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Comment</span>
                    <textarea
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      rows={4}
                      value={draft.comment}
                      onChange={(event) =>
                        handleDraftChange(research.id, 'comment', event.target.value)
                      }
                      placeholder="Provide your review comment..."
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Suggestion</span>
                    <textarea
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                      rows={4}
                      value={draft.suggestion}
                      onChange={(event) =>
                        handleDraftChange(research.id, 'suggestion', event.target.value)
                      }
                      placeholder="Optional suggested edits..."
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy}
                    onClick={() => handleReview(research)}
                  >
                    {busy ? 'Saving...' : 'Add Comment/Suggestion'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy}
                    onClick={() => handleReview(research, 'needs_revision')}
                  >
                    Request Edits
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy}
                    onClick={() => handleReview(research, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busy}
                    onClick={() => handleReview(research, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
