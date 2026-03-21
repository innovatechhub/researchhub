import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ResearchSubmissionForm } from '../../components/research/ResearchSubmissionForm';
import {
  listStudentResearchesUseCase,
  submitResearchUseCase
} from '../../../application/usecases/researchUseCases';
import { listResearchCategoriesUseCase, listStrandsUseCase } from '../../../application/usecases/adminUseCases';
import { formatDate } from '../../../core/utils/date';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  needs_revision: 'bg-sky-100 text-sky-800'
};

export function SubmitResearchPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [researches, setResearches] = useState([]);
  const [strands, setStrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadResearches = useCallback(async () => {
    if (!hasSupabaseConfig || !user) {
      setResearches([]);
      return;
    }

    try {
      const data = await listStudentResearchesUseCase(user.id);
      setResearches(data);
    } catch (error) {
      toast.error(error.message || 'Unable to load research records.');
    }
  }, [hasSupabaseConfig, toast, user]);

  const loadSubmissionOptions = useCallback(async () => {
    if (!hasSupabaseConfig || !user) {
      setStrands([]);
      setCategories([]);
      return;
    }

    try {
      const [strandData, categoryData] = await Promise.all([
        listStrandsUseCase(),
        listResearchCategoriesUseCase()
      ]);
      setStrands(strandData);
      setCategories(categoryData);
    } catch (error) {
      toast.error(error.message || 'Unable to load strand/category options.');
    }
  }, [hasSupabaseConfig, toast, user]);

  useEffect(() => {
    let isActive = true;

    const loadPageData = async () => {
      setLoading(true);
      await Promise.all([loadResearches(), loadSubmissionOptions()]);

      if (isActive) {
        setLoading(false);
      }
    };

    loadPageData();

    return () => {
      isActive = false;
    };
  }, [loadResearches, loadSubmissionOptions]);

  const handleCloseModal = () => {
    if (submitting) {
      return;
    }

    setIsAddModalOpen(false);
  };

  const handleSubmit = async (payload) => {
    if (!hasSupabaseConfig || !user) {
      throw new Error('Authentication is required before submitting research.');
    }

    setSubmitting(true);

    try {
      await submitResearchUseCase({
        studentId: user.id,
        ...payload
      });

      toast.success('Research submitted successfully. It is now pending review.');
      setIsAddModalOpen(false);
      await loadResearches();
    } finally {
      setSubmitting(false);
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
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Research</h2>
          <p className="text-sm text-slate-500">Manage and submit your research records.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Research
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Research Title</th>
                <th className="px-4 py-3 font-semibold">Strand</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {researches.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={6}>
                    No research submissions yet.
                  </td>
                </tr>
              ) : (
                researches.map((research) => (
                  <tr className="border-b border-slate-100" key={research.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{research.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.strand || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.category || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.year ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          statusStyles[research.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {research.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(research.submittedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6 sm:flex sm:items-center sm:justify-center sm:py-8"
          onClick={handleCloseModal}
        >
          <div
            className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-research-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg" id="submit-research-modal-title">
                  Submit New Research
                </h3>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Fill in the details and upload your PDF or Word file.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                onClick={handleCloseModal}
                disabled={submitting}
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-4 sm:max-h-[calc(100vh-10rem)] sm:px-6 sm:py-5">
              <ResearchSubmissionForm
                onSubmit={handleSubmit}
                submitting={submitting}
                strandOptions={strands}
                categoryOptions={categories}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
