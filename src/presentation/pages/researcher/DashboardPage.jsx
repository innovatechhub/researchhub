import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../../core/utils/date';
import {
  getApprovedResearchFileDownloadUrlUseCase,
  listApprovedResearchesUseCase
} from '../../../application/usecases/researchUseCases';

const ROWS_PER_PAGE = 10;

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getDocumentFormatFromPath(filePath) {
  const normalizedPath = String(filePath || '').toLowerCase();
  if (normalizedPath.endsWith('.pdf')) {
    return 'pdf';
  }

  if (normalizedPath.endsWith('.doc') || normalizedPath.endsWith('.docx')) {
    return 'word';
  }

  return 'unknown';
}

function getDocumentFormatLabel(format) {
  if (format === 'pdf') {
    return 'PDF Document';
  }

  if (format === 'word') {
    return 'Word Document';
  }

  return 'Original File';
}

function sanitizeDownloadName(value) {
  return String(value || 'research')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function triggerBlobDownload({ blob, fileName }) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function getFileExtensionFromPath(filePath) {
  const normalizedPath = String(filePath || '').toLowerCase();
  const dotIndex = normalizedPath.lastIndexOf('.');
  if (dotIndex === -1) {
    return 'bin';
  }

  return normalizedPath.slice(dotIndex + 1) || 'bin';
}

async function fetchBlobFromSignedUrl(signedUrl) {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error('Unable to fetch research file for download.');
  }

  return response.blob();
}

async function convertDocxBlobToPdfBlob(docxBlob) {
  const [{ jsPDF }, mammoth] = await Promise.all([
    import('jspdf'),
    import('mammoth/mammoth.browser')
  ]);

  const arrayBuffer = await docxBlob.arrayBuffer();
  const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
  const normalizedText = String(rawText || '').replace(/\r\n/g, '\n').trim();

  if (!normalizedText) {
    throw new Error('No readable text found in the DOCX file.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const maxLineWidth = pageWidth - margin * 2;
  const lineHeight = 16;

  pdf.setFont('times', 'normal');
  pdf.setFontSize(12);

  let cursorY = margin;
  const paragraphs = normalizedText.split('\n');

  paragraphs.forEach((paragraph) => {
    const text = paragraph.trim();
    const lines = pdf.splitTextToSize(text || ' ', maxLineWidth);

    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }

      pdf.text(line, margin, cursorY);
      cursorY += lineHeight;
    });

    cursorY += 6;
  });

  return pdf.output('blob');
}

function SummaryCardIcon({ type }) {
  if (type === 'published') {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M7 5h10a2 2 0 0 1 2 2v12l-3-1.8L13 19l-3-1.8L7 19V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === 'categories') {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <rect height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="8" x="4" y="4" />
        <rect height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="8" x="12" y="14" />
        <rect height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="8" x="4" y="14" />
        <rect height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" width="8" x="12" y="4" />
      </svg>
    );
  }

  if (type === 'strands') {
    return (
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8.8 10.9 14M15 8.8 13.1 14M9.3 17h5.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <rect height="16" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="4" />
      <path d="M8.5 2.8v3M15.5 2.8v3M8.5 10.5h7M8.5 14.5h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function ResearcherDashboardPage() {
  const { user, hasSupabaseConfig, role } = useAuth();
  const toast = useToast();
  const canDownloadFiles = role !== 'researcher';
  const [researches, setResearches] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [strandFilter, setStrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fileLoadingId, setFileLoadingId] = useState('');
  const [exportingAll, setExportingAll] = useState(false);
  const [expandedResearchId, setExpandedResearchId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDownloadFormat, setSelectedDownloadFormat] = useState('pdf');

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
        toast.error(error.message || 'Unable to load published research.');
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
        const isSearchMatch =
          normalizeText(research.title).includes(needle) ||
          research.keywords.some((keyword) => normalizeText(keyword).includes(needle)) ||
          research.authors.some((author) => normalizeText(author).includes(needle));

        if (!isSearchMatch) {
          return false;
        }
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
  }, [categoryFilter, researches, searchText, strandFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredResearches.length / ROWS_PER_PAGE)),
    [filteredResearches.length]
  );

  const paginatedResearches = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredResearches.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [currentPage, filteredResearches]);

  const emptyRowsCount = useMemo(() => {
    if (paginatedResearches.length === 0) {
      return 0;
    }

    return ROWS_PER_PAGE - paginatedResearches.length;
  }, [paginatedResearches.length]);

  const expandedResearch = useMemo(
    () => paginatedResearches.find((research) => research.id === expandedResearchId) ?? null,
    [expandedResearchId, paginatedResearches]
  );

  useEffect(() => {
    if (expandedResearchId && !expandedResearch) {
      setExpandedResearchId('');
    }
  }, [expandedResearch, expandedResearchId]);

  useEffect(() => {
    if (!expandedResearch) {
      return;
    }

    const format = getDocumentFormatFromPath(expandedResearch.filePath);
    setSelectedDownloadFormat(format === 'unknown' ? 'pdf' : format);
  }, [expandedResearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, strandFilter, categoryFilter]);

  useEffect(() => {
    setCurrentPage((current) => (current > totalPages ? totalPages : current));
  }, [totalPages]);

  const handleOpenFile = async (research) => {
    if (!canDownloadFiles) {
      toast.info('Researcher accounts can only browse and view details.');
      return;
    }

    try {
      setFileLoadingId(research.id);
      const signedUrl = await getApprovedResearchFileDownloadUrlUseCase({
        status: research.status,
        filePath: research.filePath
      });
      const fileBlob = await fetchBlobFromSignedUrl(signedUrl);
      const extension = getFileExtensionFromPath(research.filePath);
      const fileName = `${sanitizeDownloadName(research.title || 'research')}.${extension}`;
      triggerBlobDownload({ blob: fileBlob, fileName });
      toast.success('Download started.', { duration: 2000 });
    } catch (error) {
      toast.error(error.message || 'Unable to download research file.');
    } finally {
      setFileLoadingId('');
    }
  };

  const handleExportAllUploaded = async () => {
    if (!canDownloadFiles) {
      toast.info('Researcher accounts can only browse and view details.');
      return;
    }

    const uploadedResearches = filteredResearches.filter((research) => !!research.filePath);
    if (uploadedResearches.length === 0) {
      toast.info('No uploaded research files available for export.');
      return;
    }

    setExportingAll(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const duplicateNameCount = new Map();
      let exportedCount = 0;
      let failedCount = 0;

      for (let index = 0; index < uploadedResearches.length; index += 1) {
        const research = uploadedResearches[index];
        try {
          const signedUrl = await getApprovedResearchFileDownloadUrlUseCase({
            status: research.status,
            filePath: research.filePath
          });
          const fileBlob = await fetchBlobFromSignedUrl(signedUrl);
          const extension = getFileExtensionFromPath(research.filePath);
          const baseName = sanitizeDownloadName(research.title || `research-${index + 1}`);
          const fileKey = `${baseName}.${extension}`;
          const duplicateCount = duplicateNameCount.get(fileKey) ?? 0;
          duplicateNameCount.set(fileKey, duplicateCount + 1);
          const zipFileName =
            duplicateCount === 0 ? fileKey : `${baseName} (${duplicateCount + 1}).${extension}`;

          zip.file(zipFileName, fileBlob);
          exportedCount += 1;
        } catch (error) {
          failedCount += 1;
        }
      }

      if (exportedCount === 0) {
        throw new Error('Unable to export any uploaded files.');
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload({ blob: zipBlob, fileName: 'ResearchHub.zip' });

      if (failedCount > 0) {
        toast.info(`Exported ${exportedCount} file(s). ${failedCount} file(s) were skipped.`);
      } else {
        toast.success(`Exported ${exportedCount} file(s) to ResearchHub.zip.`);
      }
    } catch (error) {
      toast.error(error.message || 'Unable to export uploaded files.');
    } finally {
      setExportingAll(false);
    }
  };

  const handleCloseDetailsModal = () => {
    setExpandedResearchId('');
  };

  const handleContinueDownload = async () => {
    if (!canDownloadFiles) {
      toast.info('Researcher accounts can only browse and view details.');
      return;
    }

    if (!expandedResearch) {
      return;
    }

    const actualFormat = getDocumentFormatFromPath(expandedResearch.filePath);

    if (selectedDownloadFormat === actualFormat || actualFormat === 'unknown') {
      await handleOpenFile(expandedResearch);
      return;
    }

    if (selectedDownloadFormat === 'pdf' && actualFormat === 'word') {
      const normalizedPath = String(expandedResearch.filePath || '').toLowerCase();
      if (!normalizedPath.endsWith('.docx')) {
        toast.info('DOC to PDF conversion is not supported yet. Downloading original Word file.');
        await handleOpenFile(expandedResearch);
        return;
      }

      try {
        setFileLoadingId(expandedResearch.id);
        const signedUrl = await getApprovedResearchFileDownloadUrlUseCase({
          status: expandedResearch.status,
          filePath: expandedResearch.filePath
        });
        const wordBlob = await fetchBlobFromSignedUrl(signedUrl);
        const pdfBlob = await convertDocxBlobToPdfBlob(wordBlob);
        const fileName = `${sanitizeDownloadName(expandedResearch.title || 'research')}.pdf`;
        triggerBlobDownload({ blob: pdfBlob, fileName });
        toast.success('Word file converted to PDF and downloaded.', { duration: 2500 });
      } catch (error) {
        toast.error(error.message || 'Unable to convert Word file to PDF.');
      } finally {
        setFileLoadingId('');
      }

      return;
    }

    toast.info(
      `Conversion from ${getDocumentFormatLabel(actualFormat)} to ${getDocumentFormatLabel(selectedDownloadFormat)} is not supported yet. Downloading original file.`
    );
    await handleOpenFile(expandedResearch);
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
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 text-slate-100 shadow-card">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Research Library</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Published Research Archive</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          {canDownloadFiles
            ? 'Explore approved studies with publication metadata, abstract previews, and downloadable manuscripts.'
            : 'Explore approved studies with publication metadata and abstract previews.'}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <SummaryCardIcon type="published" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{researches.length}</p>
          <p className="mt-1 text-sm text-slate-500">Published studies available.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Categories</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <SummaryCardIcon type="categories" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-brand-700">{filterOptions.categories.length}</p>
          <p className="mt-1 text-sm text-slate-500">Unique research categories.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Strands</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <SummaryCardIcon type="strands" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-sky-700">{filterOptions.strands.length}</p>
          <p className="mt-1 text-sm text-slate-500">Academic strands represented.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Years</p>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <SummaryCardIcon type="years" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-600">{filterOptions.years.length}</p>
          <p className="mt-1 text-sm text-slate-500">Distinct publication years.</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 bg-slate-50/40 px-4 py-4">
          <div
            className={[
              'grid gap-3',
              canDownloadFiles ? 'lg:grid-cols-[1.6fr_1fr_1fr_auto]' : 'lg:grid-cols-[1.6fr_1fr_1fr]'
            ].join(' ')}
          >
            <label className="space-y-1" htmlFor="research-search">
              <span className="text-xs font-medium text-slate-700">Search query</span>
              <input
                id="research-search"
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search title, author, or keyword"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>

            <label className="space-y-1" htmlFor="research-category-filter">
              <span className="text-xs font-medium text-slate-700">Category</span>
              <select
                id="research-category-filter"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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

            <label className="space-y-1" htmlFor="research-strand-filter">
              <span className="text-xs font-medium text-slate-700">Strand</span>
              <select
                id="research-strand-filter"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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

            {canDownloadFiles ? (
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                  disabled={exportingAll}
                  onClick={() => {
                    void handleExportAllUploaded();
                  }}
                >
                  {exportingAll ? 'Exporting...' : 'Export'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Authors</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Strand</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Published At</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredResearches.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={7}>
                    No published research matched your search.
                  </td>
                </tr>
              ) : (
                paginatedResearches.map((research) => (
                  <tr className="border-b border-slate-100" key={research.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{research.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {research.authors.length > 0 ? research.authors.join(', ') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.category || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.strand || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{research.year ?? 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(research.reviewedAt || research.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        onClick={() => setExpandedResearchId(research.id)}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {Array.from({ length: emptyRowsCount }).map((_, index) => (
                <tr className="border-b border-slate-100" key={`empty-row-${index}`}>
                  <td className="px-4 py-3" colSpan={7}>
                    <span className="invisible">placeholder</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-600">
            Showing {filteredResearches.length} of {researches.length} published research entries. Page {currentPage} of {totalPages}.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {expandedResearch ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:py-8"
          onClick={handleCloseDetailsModal}
        >
          <div
            className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="research-details-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg" id="research-details-modal-title">
                  {expandedResearch.title}
                </h3>
                <p className="text-xs text-slate-500">Published on {formatDate(expandedResearch.reviewedAt || expandedResearch.submittedAt)}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={handleCloseDetailsModal}
                aria-label="Close details modal"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
              </button>
            </div>

            <div className="max-h-[calc(100vh-11rem)] space-y-6 overflow-y-auto px-5 py-4 sm:max-h-[calc(100vh-10rem)] sm:px-6 sm:py-5">
              <section className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Research Title</p>
                  <p className="mt-1 text-base font-semibold leading-6 text-slate-900">
                    {expandedResearch.title || 'N/A'}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Authors</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                    {expandedResearch.authors.length > 0 ? expandedResearch.authors.join(', ') : 'N/A'}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Publication Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(expandedResearch.reviewedAt || expandedResearch.submittedAt)}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Category</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{expandedResearch.category || 'N/A'}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Strand</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{expandedResearch.strand || 'N/A'}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Academic Year</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{expandedResearch.year ?? 'N/A'}</p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Document Format</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {getDocumentFormatLabel(getDocumentFormatFromPath(expandedResearch.filePath))}
                  </p>
                </article>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Abstract</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {expandedResearch.abstract || 'No abstract provided.'}
                </p>
              </section>

              {expandedResearch.keywords.length > 0 ? (
                <section className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {expandedResearch.keywords.map((keyword) => (
                      <span
                        className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        key={`${expandedResearch.id}-${keyword}`}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {expandedResearch.comments.length > 0 ? (
                <section className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reviewer Notes</h4>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {expandedResearch.comments.map((comment) => (
                      <article className="rounded-md bg-white p-3" key={comment.id}>
                        <p className="text-sm text-slate-800">{comment.comment}</p>
                        {comment.suggestion ? (
                          <p className="mt-1 text-xs text-slate-600">Suggestion: {comment.suggestion}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">{formatDate(comment.createdAt)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {canDownloadFiles ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Download Options</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="space-y-1" htmlFor="research-save-as">
                      <span className="text-xs text-slate-600">Save as</span>
                      <select
                        id="research-save-as"
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-[220px]"
                        value={selectedDownloadFormat}
                        onChange={(event) => setSelectedDownloadFormat(event.target.value)}
                      >
                        <option value="pdf">PDF Document</option>
                        <option value="word">Word Document</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={fileLoadingId === expandedResearch.id}
                      onClick={() => {
                        void handleContinueDownload();
                      }}
                    >
                      {fileLoadingId === expandedResearch.id
                        ? 'Preparing file...'
                        : `Save as ${selectedDownloadFormat === 'word' ? 'Word' : 'PDF'}`}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Available file: {getDocumentFormatLabel(getDocumentFormatFromPath(expandedResearch.filePath))}
                  </p>
                </section>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={handleCloseDetailsModal}
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
