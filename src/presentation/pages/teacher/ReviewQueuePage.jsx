import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiUser
} from 'react-icons/fi';
import { useToast } from '../../../app/providers/ToastProvider';
import { loadWorkspace, rpc } from '../../../infrastructure/repositories/workflowRepository';
import { chapterFeedback, schoolDate } from '../../../domain/chapters.mjs';
import { StatusBadge, researchState } from '../../components/portal/StatusBadge';
import {
  ChapterReviewPanel,
  RevisionHistory,
  sectionTitlesFor
} from '../../components/portal/ChapterReviewPanel';

const FILTERS = [
  ['all', 'All'],
  ['submitted', 'Pending'],
  ['needs_revision', 'For Revision'],
  ['approved', 'Approved']
];
const TABS = [
  ['chapters', 'Research Chapters', FiBookOpen],
  ['history', 'Submission History', FiClock],
  ['profile', 'Student Profile', FiUser]
];

function Kpi({ tone, icon: Icon, label, value, note }) {
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <span className="kpi-icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-3xl font-extrabold text-navy-900">{value}</p>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
    </div>
  );
}

// Teacher dashboard: KPI cards, searchable review queue, and the selected student's chapters.
export function ReviewQueuePage({ initialFilter = 'all' }) {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [tab, setTab] = useState('chapters');
  const [chapterId, setChapterId] = useState('');

  useEffect(() => setFilter(initialFilter), [initialFilter]);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await rpc('workflow_progress'));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter(
      (r) =>
        (!needle || `${r.title} ${r.student_name || ''}`.toLowerCase().includes(needle)) &&
        (filter === 'all' || researchState(r) === filter)
    );
  }, [records, search, filter]);

  // Keep a valid selection: first visible row unless the current one is still listed.
  useEffect(() => {
    if (visible.some((r) => r.id === selectedId)) return;
    // Open the research that most needs attention first, not just the most recently updated.
    const next =
      visible.find((r) => researchState(r) === 'submitted') ||
      visible.find((r) => researchState(r) === 'needs_revision') ||
      visible[0];
    setSelectedId(next?.id || '');
  }, [visible, selectedId]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return setData(null);
    try {
      const next = await loadWorkspace(id);
      setData(next);
      setDetailError('');
      setChapterId((current) =>
        next.chapters.some((c) => c.id === current) ? current : next.chapters[0]?.id || ''
      );
    } catch (e) {
      setData(null);
      setDetailError(e.message);
    }
  }, []);
  useEffect(() => {
    let live = true;
    setData(null);
    if (selectedId) loadDetail(selectedId).catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [selectedId, loadDetail]);

  const counts = useMemo(() => {
    const by = (state) => records.filter((r) => researchState(r) === state).length;
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      total: records.length,
      week: records.filter((r) => new Date(r.updated_at) >= weekAgo).length,
      pending: by('submitted'),
      revision: by('needs_revision'),
      approved: by('approved')
    };
  }, [records]);

  const selected = records.find((r) => r.id === selectedId);
  const chapter = data?.chapters.find((c) => c.id === chapterId);
  const nameOf = (id) => data?.directory.find((p) => p.id === id)?.full_name;

  async function refreshAll() {
    await Promise.all([loadRecords(), loadDetail(selectedId)]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          tone="total"
          icon={FiFileText}
          label="Total Submissions"
          value={counts.total}
          note={`${counts.week} updated this week`}
        />
        <Kpi tone="pending" icon={FiClock} label="Pending Review" value={counts.pending} />
        <Kpi tone="revision" icon={FiRefreshCw} label="For Revision" value={counts.revision} />
        <Kpi tone="approved" icon={FiCheckCircle} label="Approved" value={counts.approved} />
      </div>

      <div className="dash-split">
        <section className="card-pane" aria-label="My Review Queue">
          <div className="card-pane-head">
            <FiFileText aria-hidden="true" /> My Review Queue
          </div>
          <div className="space-y-3 border-b border-[#d6e0f3] p-3">
            <label className="relative block">
              <span className="sr-only">Search by student name or research title</span>
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                className="workspace-input !pl-9"
                placeholder="Search by student name or research title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    filter === value
                      ? 'border-navy-800 bg-navy-800 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p role="status" className="empty-panel">
              Loading queue…
            </p>
          ) : error ? (
            <p className="notice error-notice m-3" role="alert">
              {error}{' '}
              <button className="underline" onClick={loadRecords}>
                Retry
              </button>
            </p>
          ) : !visible.length ? (
            <p className="empty-panel">
              {records.length ? 'No research matches your search.' : 'No assigned research yet.'}
            </p>
          ) : (
            <ul className="max-h-[640px] overflow-y-auto">
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="queue-item"
                    aria-current={r.id === selectedId}
                    onClick={() => {
                      setSelectedId(r.id);
                      setTab('chapters');
                    }}
                  >
                    <span className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-100 text-navy-600">
                        <FiUser aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="text-[15px] text-navy-900">
                            {r.student_name || 'Student'}
                          </strong>
                          <StatusBadge status={researchState(r)} />
                        </span>
                        <span className="block text-sm italic text-slate-600">{r.title}</span>
                        <span className="block text-xs text-slate-500">
                          {schoolDate(r.updated_at)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-pane" aria-label="Selected research">
          {!selected ? (
            <p className="empty-panel">Select a student from the queue to review their research.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 bg-navy-800 px-5 py-4 text-white">
                <FiBookOpen aria-hidden="true" className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-extrabold">{selected.student_name || 'Student'}</h2>
                  <p className="text-sm italic text-blue-100">{selected.title}</p>
                </div>
                <StatusBadge status={researchState(selected)} />
                <Link
                  className="text-sm font-semibold text-blue-100 underline"
                  to={`/teacher/research/${selected.id}`}
                >
                  Open full workspace
                </Link>
              </div>
              <div role="tablist" className="flex gap-1 border-b border-[#d6e0f3] bg-white px-3">
                {TABS.map(([key, label, Icon]) => (
                  <button
                    key={key}
                    role="tab"
                    type="button"
                    aria-selected={tab === key}
                    className={`flex items-center gap-2 border-b-[3px] px-4 py-3 text-sm font-semibold ${
                      tab === key
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-600 hover:text-navy-800'
                    }`}
                    onClick={() => setTab(key)}
                  >
                    <Icon aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {detailError ? (
                  <p className="notice error-notice" role="alert">
                    {detailError}{' '}
                    <button className="underline" onClick={() => loadDetail(selectedId)}>
                      Retry
                    </button>
                  </p>
                ) : !data ? (
                  <p role="status" className="empty-panel">
                    Loading research…
                  </p>
                ) : tab === 'profile' ? (
                  <StudentProfile data={data} record={selected} />
                ) : tab === 'history' ? (
                  <AllHistory data={data} />
                ) : !data.chapters.length ? (
                  <p className="empty-panel">
                    This research has no chapters yet. The student has not uploaded a manuscript.
                  </p>
                ) : (
                  <div className="dash-detail">
                    <nav aria-label="Research chapters" className="space-y-2">
                      <h3 className="px-1 font-bold text-navy-900">Research Chapters</h3>
                      {data.chapters.map((c) => {
                        const v = data.versions.find((x) => x.id === c.current_version_id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={c.id === chapterId}
                            className={`chapter-tab !mb-0 ${c.id === chapterId ? 'selected' : ''}`}
                            onClick={() => setChapterId(c.id)}
                          >
                            <span className="mb-1 flex items-center justify-between gap-2 font-bold">
                              Chapter {c.position}
                              {v?.status === 'needs_revision' ? (
                                <span className="text-red-600" title="For revision">
                                  ●
                                </span>
                              ) : v?.status === 'approved' ? (
                                <FiCheck className="text-green-700" aria-label="Approved" />
                              ) : null}
                            </span>
                            <span className="block text-slate-600">{c.title}</span>
                            <span className="mt-2 block">
                              <StatusBadge status={v?.status || 'none'} />
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                    {chapter && (
                      <ChapterDetail
                        key={chapter.id}
                        data={data}
                        chapter={chapter}
                        fileLabel={`Chapter${chapter.position}_${chapter.title.replace(/\W+/g, '_')}`}
                        nameOf={nameOf}
                        toast={toast}
                        onSaved={refreshAll}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ChapterDetail({ data, chapter, fileLabel, nameOf, toast, onSaved }) {
  const version = data.versions.find((v) => v.id === chapter.current_version_id);
  const titles = sectionTitlesFor(chapter);
  const [section, setSection] = useState('');
  const [severity, setSeverity] = useState('major');
  const [correction, setCorrection] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const canReview = version && version.status !== 'draft';

  async function save(approve) {
    const fix = correction.trim();
    const note = remarks.trim();
    if (!approve && !fix && !note) return toast.error('Write a correction or a remark first.');
    setBusy(true);
    try {
      if (approve) {
        await rpc('workflow_review', {
          p_version: version.id,
          p_decision: 'approved',
          p_comment: note,
          p_section: null,
          p_severity: null
        });
      } else {
        if (fix)
          await rpc('workflow_review', {
            p_version: version.id,
            // Only a freshly submitted version can be sent back; later corrections are notes.
            p_decision: version.status === 'submitted' ? 'needs_revision' : 'feedback',
            p_comment: fix,
            p_section: section || null,
            p_severity: severity
          });
        if (note)
          await rpc('workflow_review', {
            p_version: version.id,
            p_decision: 'feedback',
            p_comment: note,
            p_section: section || null,
            p_severity: null
          });
      }
      setCorrection('');
      setRemarks('');
      toast.success(approve ? 'Chapter approved.' : 'Corrections saved.');
      await onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ChapterReviewPanel
        data={data}
        chapter={chapter}
        fileLabel={fileLabel}
        nameOf={nameOf}
        contentHeading="Submitted File"
        onSectionChange={(s) => setSection(s && titles.includes(s) ? s : '')}
      >
        {canReview && (
          <section className="card-pane">
            <h3 className="bg-navy-50 px-4 py-3 font-bold text-navy-900">Add Corrections</h3>
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="workspace-label">
                  Section
                  <select
                    className="workspace-input mt-1"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="">Whole chapter</option>
                    {titles.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="workspace-label">
                  Severity
                  <select
                    className="workspace-input mt-1"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="major">Major Revision</option>
                    <option value="minor">Minor Revision</option>
                  </select>
                </label>
              </div>
              <label className="workspace-label">
                Correction
                <textarea
                  className="workspace-input mt-1"
                  rows="3"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="What must the student fix?"
                />
              </label>
              <label className="workspace-label">
                Add Remarks <span className="font-normal text-slate-500">(Optional)</span>
                <textarea
                  className="workspace-input mt-1"
                  rows="2"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Type additional notes…"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={busy || version.status !== 'submitted'}
                  title={
                    version.status !== 'submitted'
                      ? 'Only a newly submitted version can be approved.'
                      : undefined
                  }
                  onClick={() => save(true)}
                >
                  <FiCheck aria-hidden="true" /> Approve chapter
                </button>
                <button
                  type="button"
                  className="button button-navy"
                  disabled={busy}
                  onClick={() => save(false)}
                >
                  <FiCheck aria-hidden="true" /> Save Corrections
                </button>
              </div>
            </div>
          </section>
        )}
      </ChapterReviewPanel>
      <RevisionHistory data={data} chapter={chapter} />
    </div>
  );
}

function AllHistory({ data }) {
  const chapterOf = (id) => data.chapters.find((c) => c.id === id);
  const versions = [...data.versions].sort(
    (a, b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at)
  );
  return (
    <div className="overflow-x-auto">
      <table className="report-table">
        <thead>
          <tr>
            <th>Chapter</th>
            <th>Version</th>
            <th>Date Submitted</th>
            <th>Status</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>{chapterOf(v.chapter_id)?.title}</td>
              <td>v{v.version_number}.0</td>
              <td>{schoolDate(v.submitted_at || v.created_at)}</td>
              <td>
                <StatusBadge status={v.status} />
              </td>
              <td>{data.reviews.filter((r) => r.version_id === v.id).length}</td>
            </tr>
          ))}
          {!versions.length && (
            <tr>
              <td colSpan="5">No submissions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StudentProfile({ data, record }) {
  const r = data.research;
  const fields = [
    ['Student', record.student_name],
    ['Authors', r.authors?.join(', ')],
    ['Strand', r.strand],
    ['Category', r.category],
    ['Research year', r.year],
    ['Completion', `${record.approved_count}/${record.required_count} chapters approved`]
  ];
  const feedbackCount = data.chapters.reduce(
    (n, c) => n + chapterFeedback(data.reviews, data.versions, c.id).length,
    0
  );
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-navy-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 font-semibold text-navy-900">{value || '—'}</dd>
        </div>
      ))}
      <div className="rounded-xl bg-navy-50 p-3 sm:col-span-2">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Abstract</dt>
        <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.abstract || '—'}</dd>
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2">
        {feedbackCount} feedback {feedbackCount === 1 ? 'entry' : 'entries'} given so far.
      </p>
    </dl>
  );
}
