import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../../core/utils/date';
import {
  getApprovedResearchFileDownloadUrlUseCase,
  listApprovedResearchesUseCase
} from '../../../application/usecases/researchUseCases';

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function ResearcherDashboardPage() {
  const { user, hasSupabaseConfig } = useAuth();
  const toast = useToast();
  const [researches, setResearches] = useState([]);
  const [searchBy, setSearchBy] = useState('title');
  const [searchText, setSearchText] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [strandFilter, setStrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [expandedResearchId, setExpandedResearchId] = useState('');

  const loadResearches = useCallback(
    async () => {
      if (!hasSupabaseConfig || !user) {
        setLoading(false);
        return;
      }

      try {
        const records = await listApprovedResearchesUseCase();
        setResearches(records);
      } catch (error) {
        toast.error(error.message || 'Unable to load approved research.');
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
    const yearSet = new Set();
    const strandSet = new Set();
    const categorySet = new Set();

    researches.forEach((research) => {
      if (research.year) {
        yearSet.add(String(research.year));
      }

      if (research.strand) {
        strandSet.add(research.strand);
      }

      if (research.category) {
        categorySet.add(research.category);
      }
    });

    const years = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
    const strands = Array.from(strandSet).sort((a, b) => a.localeCompare(b));
    const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

    return { years, strands, categories };
  }, [researches]);

  const filteredResearches = useMemo(() => {
    return researches.filter((research) => {
      const needle = normalizeText(searchText);

      if (needle) {
        let isSearchMatch = false;

        if (searchBy === 'title') {
          isSearchMatch = normalizeText(research.title).includes(needle);
        } else if (searchBy === 'keyword') {
          isSearchMatch = research.keywords.some((keyword) => normalizeText(keyword).includes(needle));
        } else if (searchBy === 'author') {
          isSearchMatch = research.authors.some((author) => normalizeText(author).includes(needle));
        }

        if (!isSearchMatch) {
          return false;
        }
      }

      if (yearFilter !== 'all' && String(research.year ?? '') !== yearFilter) {
        return false;
      }

      if (strandFilter !== 'all' && normalizeText(research.strand) !== normalizeText(strandFilter)) {
        return false;
      }

      if (
        categoryFilter !== 'all' &&
        normalizeText(research.category) !== normalizeText(categoryFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [categoryFilter, researches, searchBy, searchText, strandFilter, yearFilter]);

  const handleResetFilters = () => {
    setSearchBy('title');
    setSearchText('');
    setYearFilter('all');
    setStrandFilter('all');
    setCategoryFilter('all');
  };

  const handleOpenFile = async (research) => {
    try {
      setFileLoadingId(research.id);
      const signedUrl = await getApprovedResearchFileDownloadUrlUseCase({
        status: research.status,
        filePath: research.filePath
      });
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
      toast.success('Download prepared.', { duration: 2000 });
    } catch (error) {
      toast.error(error.message || 'Unable to download research file.');
    } finally {
      setFileLoadingId('');
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
        <p className="text-sm uppercase tracking-wide text-brand-100">Researcher Dashboard</p>
        <h2 className="mt-2 text-2xl font-bold">Browse Approved Research</h2>
        <p className="mt-2 text-sm text-brand-100">
          Search approved studies, open details, and download available files.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2" htmlFor="research-search-by">
            <span className="text-sm font-medium text-slate-700">Search by</span>
            <select
              id="research-search-by"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={searchBy}
              onChange={(event) => setSearchBy(event.target.value)}
            >
              <option value="title">Title</option>
              <option value="keyword">Keyword</option>
              <option value="author">Author</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-1 xl:col-span-2" htmlFor="research-search">
            <span className="text-sm font-medium text-slate-700">Search query</span>
            <input
              id="research-search"
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Enter title, keyword, or author"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="space-y-2" htmlFor="research-year-filter">
            <span className="text-sm font-medium text-slate-700">Year</span>
            <select
              id="research-year-filter"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="all">All years</option>
              {filterOptions.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2" htmlFor="research-strand-filter">
            <span className="text-sm font-medium text-slate-700">Strand</span>
            <select
              id="research-strand-filter"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={strandFilter}
              onChange={(event) => setStrandFilter(event.target.value)}
            >
              <option value="all">All strands</option>
              {filterOptions.strands.map((strand) => (
                <option key={strand} value={strand}>
                  {strand}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 xl:col-span-2" htmlFor="research-category-filter">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select
              id="research-category-filter"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end xl:col-span-1">
            <button
              type="button"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={handleResetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>
      </section>

      <p className="text-sm text-slate-600">
        Showing {filteredResearches.length} of {researches.length} approved research entries.
      </p>

      {filteredResearches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          No approved research matched your search.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResearches.map((research) => (
            <article className="rounded-2xl bg-white p-5 shadow-card" key={research.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{research.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Approved on {formatDate(research.reviewedAt || research.submittedAt)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  approved
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() =>
                    setExpandedResearchId((current) => (current === research.id ? '' : research.id))
                  }
                >
                  {expandedResearchId === research.id ? 'Hide details' : 'View details'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  disabled={fileLoadingId === research.id}
                  onClick={() => handleOpenFile(research)}
                >
                  {fileLoadingId === research.id ? 'Preparing file...' : 'Download file'}
                </button>
              </div>

              {expandedResearchId === research.id ? (
                <section className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Research Details</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{research.abstract}</p>
                  </div>

                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-700">Authors:</span>{' '}
                      {research.authors.length > 0 ? research.authors.join(', ') : 'N/A'}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Year:</span>{' '}
                      {research.year ?? 'N/A'}
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
                    <div className="flex flex-wrap gap-2">
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

                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Teacher Comments</h4>
                    {research.comments.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No teacher comments available.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {research.comments.map((comment) => (
                          <div className="rounded-lg bg-white p-3" key={comment.id}>
                            <p className="text-sm text-slate-800">{comment.comment}</p>
                            {comment.suggestion ? (
                              <p className="mt-1 text-xs text-slate-600">
                                Suggestion: {comment.suggestion}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDate(comment.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
