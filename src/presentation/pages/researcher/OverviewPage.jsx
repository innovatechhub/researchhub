import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { listApprovedResearchesUseCase } from '../../../application/usecases/researchUseCases';
import { ROUTES } from '../../../core/constants/routes';
import { formatDate } from '../../../core/utils/date';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export function ResearcherOverviewPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [researches, setResearches] = useState([]);

  const loadDashboardData = useCallback(async () => {
    if (!hasSupabaseConfig || !user) {
      setResearches([]);
      setLoading(false);
      return;
    }

    try {
      const records = await listApprovedResearchesUseCase();
      setResearches(records);
    } catch (error) {
      toast.error(error.message || 'Unable to load researcher dashboard.');
    } finally {
      setLoading(false);
    }
  }, [hasSupabaseConfig, toast, user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const stats = useMemo(() => {
    const categorySet = new Set();
    const strandSet = new Set();
    const yearSet = new Set();

    researches.forEach((research) => {
      if (research.category) {
        categorySet.add(research.category);
      }
      if (research.strand) {
        strandSet.add(research.strand);
      }
      if (research.year) {
        yearSet.add(String(research.year));
      }
    });

    return {
      totalPublished: researches.length,
      totalCategories: categorySet.size,
      totalStrands: strandSet.size,
      totalYears: yearSet.size
    };
  }, [researches]);

  const latestPublished = useMemo(() => researches.slice(0, 6), [researches]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-slate-100 shadow-card">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Researcher Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Research Archive Overview</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Browse the latest approved research and open details from the library.
        </p>
        <div className="mt-4">
          <Link
            to={ROUTES.researcherLibrary}
            className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Open Research Library
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{stats.totalPublished}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Categories</p>
          <p className="mt-2 text-3xl font-bold text-brand-700">{stats.totalCategories}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Strands</p>
          <p className="mt-2 text-3xl font-bold text-sky-700">{stats.totalStrands}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Years</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{stats.totalYears}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Latest Approved Research</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {latestPublished.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">No approved research found.</p>
          ) : (
            latestPublished.map((research) => (
              <article className="px-4 py-3" key={research.id}>
                <p className="text-sm font-semibold text-slate-900">{research.title}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {research.authors.length > 0 ? research.authors.join(', ') : 'N/A'} •{' '}
                  {research.category || 'N/A'} • {formatDate(research.reviewedAt || research.submittedAt)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
