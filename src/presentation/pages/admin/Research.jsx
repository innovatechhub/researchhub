import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { formatDate } from '../../../core/utils/date';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  getResearchFileDownloadUrlUseCase,
  listAllResearchesUseCase
} from '../../../application/usecases/researchUseCases';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  needs_revision: 'bg-sky-100 text-sky-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700'
};

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function AdminResearchPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [researches, setResearches] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [strandFilter, setStrandFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [selectedResearch, setSelectedResearch] = useState(null);

  const loadResearches = useCallback(
    async () => {
      if (!hasSupabaseConfig || !user) {
        setLoading(false);
        return;
      }

      try {
        const records = await listAllResearchesUseCase();
        setResearches(records);
      } catch (error) {
        toast.error(error.message || 'Unable to load research records.');
      } finally {
        setLoading(false);
      }
    },
    [hasSupabaseConfig, toast, user]
  );

  useEffect(() => {
    loadResearches();
  }, [loadResearches]);

  const filterOptions = useMemo(() => {
    const categories = new Set();
    const strands = new Set();
    const years = new Set();

    researches.forEach((research) => {
      if (research.category) {
        categories.add(research.category);
      }
      if (research.strand) {
        strands.add(research.strand);
      }
      if (research.year) {
        years.add(research.year);
      }
    });

    return {
      categories: Array.from(categories).sort((a, b) => a.localeCompare(b)),
      strands: Array.from(strands).sort((a, b) => a.localeCompare(b)),
      years: Array.from(years).sort((a, b) => b - a)
    };
  }, [researches]);

  const filteredResearches = useMemo(() => {
    return researches.filter((research) => {
      const needle = normalizeText(searchText);
      if (needle) {
        const matchesSearch =
          normalizeText(research.title).includes(needle) ||
          normalizeText(research.abstract).includes(needle) ||
          research.authors.some((author) => normalizeText(author).includes(needle)) ||
          research.keywords.some((keyword) => normalizeText(keyword).includes(needle));

        if (!matchesSearch) {
          return false;
        }
      }

      if (categoryFilter !== 'all' && normalizeText(research.category) !== normalizeText(categoryFilter)) {
        return false;
      }

      if (strandFilter !== 'all' && normalizeText(research.strand) !== normalizeText(strandFilter)) {
        return false;
      }

      if (yearFilter !== 'all' && String(research.year ?? '') !== yearFilter) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, researches, searchText, strandFilter, yearFilter]);

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

  const handleViewResearch = (research) => {
    setSelectedResearch(research);
  };

  const handleCloseResearchDetails = () => {
    setSelectedResearch(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 md:col-span-2 xl:col-span-1" htmlFor="admin-research-search">
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input
              id="admin-research-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Title, abstract, author, or keyword"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="space-y-2" htmlFor="admin-research-category-filter">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select
              id="admin-research-category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2" htmlFor="admin-research-strand-filter">
            <span className="text-sm font-medium text-slate-700">Strand</span>
            <select
              id="admin-research-strand-filter"
              value={strandFilter}
              onChange={(event) => setStrandFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All strands</option>
              {filterOptions.strands.map((strand) => (
                <option key={strand} value={strand}>
                  {strand}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2" htmlFor="admin-research-year-filter">
            <span className="text-sm font-medium text-slate-700">School Year</span>
            <select
              id="admin-research-year-filter"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">All school years</option>
              {filterOptions.years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Strand</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResearches.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={7}>
                    No research records matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredResearches.map((research) => (
                  <tr className="border-b border-slate-100 align-top" key={research.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{research.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {research.authors.length > 0 ? research.authors.join(', ') : 'No author list'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{research.year ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{research.category || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{research.strand || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                          STATUS_STYLES[research.status] || 'bg-slate-100 text-slate-700'
                        ].join(' ')}
                      >
                        {research.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(research.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleViewResearch(research)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedResearch ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:py-8"
          onClick={handleCloseResearchDetails}
        >
          <div
            className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-research-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg" id="admin-research-details-title">
                  {selectedResearch.title}
                </h3>
                <p className="text-xs text-slate-500">Submitted on {formatDate(selectedResearch.submittedAt)}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close details modal"
                onClick={handleCloseResearchDetails}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
            </div>

            <div className="max-h-[calc(100vh-11rem)] space-y-5 overflow-y-auto px-5 py-4 sm:max-h-[calc(100vh-10rem)] sm:px-6 sm:py-5">
              <span
                className={[
                  'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                  STATUS_STYLES[selectedResearch.status] || 'bg-slate-100 text-slate-700'
                ].join(' ')}
              >
                {selectedResearch.status.replace('_', ' ')}
              </span>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Abstract</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {selectedResearch.abstract || 'No abstract provided.'}
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Authors</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                    {selectedResearch.authors.length > 0 ? selectedResearch.authors.join(', ') : 'N/A'}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Year</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedResearch.year ?? 'N/A'}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Category</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedResearch.category || 'N/A'}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Strand</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedResearch.strand || 'N/A'}</p>
                </article>
              </section>

              {selectedResearch.keywords.length > 0 ? (
                <section className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedResearch.keywords.map((keyword) => (
                      <span
                        className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        key={`${selectedResearch.id}-${keyword}`}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={fileLoadingId === selectedResearch.id || !selectedResearch.filePath}
                onClick={() => {
                  void handleOpenFile(selectedResearch);
                }}
              >
                {fileLoadingId === selectedResearch.id ? 'Preparing file...' : 'Open file'}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={handleCloseResearchDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
