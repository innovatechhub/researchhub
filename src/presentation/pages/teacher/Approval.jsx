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

export function TeacherApprovalPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState('');

  const loadApprovalRows = useCallback(async () => {
    if (!hasSupabaseConfig || !user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      const data = await listTeacherResearchQueueUseCase();
      setRecords(data);
    } catch (error) {
      toast.error(error.message || 'Unable to load approval records.');
    } finally {
      setLoading(false);
    }
  }, [hasSupabaseConfig, toast, user]);

  useEffect(() => {
    loadApprovalRows();
  }, [loadApprovalRows]);

  const handleOpenModal = (entry) => {
    setSelectedRecord(entry);
    setDrafts((current) => ({
      ...current,
      [entry.id]: {
        comment: current[entry.id]?.comment ?? '',
        suggestion: current[entry.id]?.suggestion ?? ''
      }
    }));
  };

  const handleCloseModal = () => {
    if (selectedRecord && actionLoadingId === selectedRecord.id) {
      return;
    }

    setSelectedRecord(null);
  };

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

  const handleOpenFile = async (entry) => {
    try {
      setFileLoadingId(entry.id);
      const signedUrl = await getResearchFileDownloadUrlUseCase(entry.filePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Unable to open research file.');
    } finally {
      setFileLoadingId('');
    }
  };

  const handleAction = async (entry, status) => {
    const draft = drafts[entry.id] ?? { comment: '', suggestion: '' };
    const comment = draft.comment;
    const suggestion = draft.suggestion;

    if (status === 'rejected') {
      if (!comment.trim()) {
        toast.error('Comment is required when rejecting a research.');
        return;
      }
    }

    setActionLoadingId(entry.id);
    try {
      await reviewResearchUseCase({
        teacherId: user.id,
        researchId: entry.id,
        comment,
        suggestion,
        status
      });

      setDrafts((current) => ({
        ...current,
        [entry.id]: { comment: '', suggestion: '' }
      }));

      if (status) {
        toast.success(`Status updated to ${status.replace('_', ' ')}.`);
      } else {
        toast.success('Comment/suggestion submitted successfully.');
      }

      await loadApprovalRows();

      if (status === 'approved' || status === 'rejected') {
        setSelectedRecord(null);
      } else if (status === 'needs_revision') {
        setSelectedRecord((current) =>
          current ? { ...current, status: 'needs_revision' } : current
        );
      }
    } catch (error) {
      toast.error(error.message || 'Unable to update research status.');
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
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Approval</h2>
        <p className="text-sm text-slate-500">
          Pending review entries with category, authors, and strand.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Authors</th>
                <th className="px-4 py-3 font-semibold">Strand</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                    No records available for approval.
                  </td>
                </tr>
              ) : (
                records.map((entry) => (
                  <tr
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    key={entry.id}
                    onClick={() => handleOpenModal(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenModal(entry);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.category || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {entry.authors.length > 0 ? entry.authors.join(', ') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.strand || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                          STATUS_STYLES[entry.status] || 'bg-slate-100 text-slate-700'
                        ].join(' ')}
                      >
                        {entry.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRecord ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6 sm:flex sm:items-center sm:justify-center sm:py-8"
          onClick={handleCloseModal}
        >
          <div
            className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-approval-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg" id="teacher-approval-modal-title">
                  Approval Details
                </h3>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Submitted on {formatDate(selectedRecord.submittedAt)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                onClick={handleCloseModal}
                disabled={actionLoadingId === selectedRecord.id}
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(100vh-11rem)] space-y-5 overflow-y-auto px-5 py-4 sm:max-h-[calc(100vh-10rem)] sm:px-6 sm:py-5">
              <span
                className={[
                  'inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize',
                  STATUS_STYLES[selectedRecord.status] || 'bg-slate-100 text-slate-700'
                ].join(' ')}
              >
                {selectedRecord.status.replace('_', ' ')}
              </span>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Research Title
                  </p>
                  <h4 className="text-base font-semibold text-slate-900">{selectedRecord.title}</h4>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Abstract</p>
                  <p className="text-sm leading-relaxed text-slate-700">{selectedRecord.abstract}</p>
                </div>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Authors</dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {selectedRecord.authors.length > 0 ? selectedRecord.authors.join(', ') : 'N/A'}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</dt>
                  <dd className="mt-1 text-sm text-slate-700">{selectedRecord.year ?? 'N/A'}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strand</dt>
                  <dd className="mt-1 text-sm text-slate-700">{selectedRecord.strand || 'N/A'}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</dt>
                  <dd className="mt-1 text-sm text-slate-700">{selectedRecord.category || 'N/A'}</dd>
                </div>
              </dl>

              <div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={fileLoadingId === selectedRecord.id}
                  onClick={() => handleOpenFile(selectedRecord)}
                >
                  {fileLoadingId === selectedRecord.id ? 'Preparing file...' : 'Open uploaded file'}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Comment</span>
                  <textarea
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    rows={4}
                    value={(drafts[selectedRecord.id]?.comment ?? '')}
                    onChange={(event) =>
                      handleDraftChange(selectedRecord.id, 'comment', event.target.value)
                    }
                    placeholder="Provide your review comment..."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Suggestion</span>
                  <textarea
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    rows={4}
                    value={(drafts[selectedRecord.id]?.suggestion ?? '')}
                    onChange={(event) =>
                      handleDraftChange(selectedRecord.id, 'suggestion', event.target.value)
                    }
                    placeholder="Optional suggested edits..."
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actionLoadingId === selectedRecord.id}
                  onClick={() => handleAction(selectedRecord)}
                >
                  {actionLoadingId === selectedRecord.id ? 'Saving...' : 'Add Comment/Suggestion'}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actionLoadingId === selectedRecord.id}
                  onClick={() => handleAction(selectedRecord, 'needs_revision')}
                >
                  {actionLoadingId === selectedRecord.id ? 'Saving...' : 'Request Edits'}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actionLoadingId === selectedRecord.id}
                  onClick={() => handleAction(selectedRecord, 'approved')}
                >
                  {actionLoadingId === selectedRecord.id ? 'Saving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={actionLoadingId === selectedRecord.id}
                  onClick={() => handleAction(selectedRecord, 'rejected')}
                >
                  {actionLoadingId === selectedRecord.id ? 'Saving...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
