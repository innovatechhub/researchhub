import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../../../app/providers/AuthProvider';
import { loadWorkspace, rpc } from '../../../infrastructure/repositories/workflowRepository';
import { schoolDate } from '../../../domain/chapters.mjs';
import { StatusBadge } from '../../components/portal/StatusBadge';
import {
  ChapterReviewPanel,
  RevisionHistory,
  sectionTitlesFor
} from '../../components/portal/ChapterReviewPanel';

// Student dashboard: welcome banner, chapter list, and the selected chapter's content and
// teacher corrections. Previous feedback stays visible because the thread spans all versions.
export function StudentHomePage() {
  const { profile, user } = useAuth();
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [researchId, setResearchId] = useState('');
  const [data, setData] = useState(null);
  const [chapterId, setChapterId] = useState('');

  const loadRecords = useCallback(async () => {
    try {
      const mine = (await rpc('workflow_progress')).filter((r) => r.student_id === user?.id);
      setRecords(mine);
      setResearchId((current) => current || mine[0]?.id || '');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [user?.id]);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let live = true;
    setData(null);
    if (!researchId) return undefined;
    loadWorkspace(researchId)
      .then((next) => {
        if (!live) return;
        setData(next);
        setChapterId(next.chapters[0]?.id || '');
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [researchId]);

  // Accepts "First Last" and "Last, First" (the form the teacher queue uses).
  const fullName = (profile?.full_name || '').trim();
  const first =
    (fullName.includes(',') ? fullName.split(',')[1] : fullName).trim().split(/\s+/)[0] || 'there';
  const chapter = data?.chapters.find((c) => c.id === chapterId);
  const nameOf = (id) => data?.directory.find((p) => p.id === id)?.full_name;
  const research = records?.find((r) => r.id === researchId);

  if (error)
    return (
      <p className="notice error-notice" role="alert">
        {error}{' '}
        <button className="underline" onClick={loadRecords}>
          Retry
        </button>
      </p>
    );
  if (!records)
    return (
      <p role="status" className="empty-panel">
        Loading your research…
      </p>
    );

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-[#cfdcf5] bg-navy-100 px-6 py-5">
        <FiBookOpen aria-hidden="true" className="h-12 w-12 text-navy-800" />
        <div className="min-w-[220px] flex-1">
          <h1 className="text-2xl font-extrabold text-navy-900">Hello, {first}!</h1>
          <p className="text-sm text-slate-700">
            Track your research submissions and view teacher corrections here.
          </p>
        </div>
        {research && (
          <div className="min-w-[220px] border-l border-navy-300 pl-5">
            <p className="text-sm font-bold text-navy-900">Research Title:</p>
            {records.length > 1 ? (
              <select
                aria-label="Choose research"
                className="workspace-input mt-1"
                value={researchId}
                onChange={(e) => setResearchId(e.target.value)}
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="font-semibold text-navy-900">{research.title}</p>
            )}
          </div>
        )}
      </section>

      {!records.length ? (
        <section className="workspace-panel space-y-3 text-center">
          <h2 className="text-lg font-bold text-navy-900">No research yet</h2>
          <p className="workspace-subtitle">
            Add your research details once, then upload your manuscript to start receiving
            corrections.
          </p>
          <Link className="button button-navy" to="/student/submit">
            Start your research submission
          </Link>
        </section>
      ) : !data ? (
        <p role="status" className="empty-panel">
          Loading research…
        </p>
      ) : !data.chapters.length ? (
        <section className="workspace-panel space-y-3 text-center">
          <h2 className="text-lg font-bold text-navy-900">Upload your manuscript</h2>
          <p className="workspace-subtitle">
            Your details are saved. Upload a PDF or DOCX to split it into chapters for your teacher.
          </p>
          <Link className="button button-navy" to={`/student/research/${researchId}`}>
            Open research workspace
          </Link>
        </section>
      ) : (
        <>
          <div className="dash-detail" style={{ gridTemplateColumns: '300px minmax(0, 1fr)' }}>
            <section className="card-pane" aria-label="Research Chapters">
              <div className="card-pane-head">
                <FiBookOpen aria-hidden="true" /> Research Chapters
              </div>
              <nav className="p-3">
                {data.chapters.map((c) => {
                  const v = data.versions.find((x) => x.id === c.current_version_id);
                  const selected = c.id === chapterId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={selected}
                      className={`chapter-tab ${selected ? 'selected' : ''}`}
                      onClick={() => setChapterId(c.id)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <strong className="!mb-0">
                          Chapter {c.position}
                          {selected ? ` – ${c.title}` : ''}
                        </strong>
                        <StatusBadge
                          status={selected && v ? 'open' : v?.status || 'none'}
                          label={selected && v ? 'Open' : undefined}
                        />
                        <FiChevronRight aria-hidden="true" />
                      </span>
                      <span className="block truncate text-slate-600">
                        {selected ? sectionTitlesFor(c).slice(0, 3).join(', ') + '…' : c.title}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-[#d6e0f3] p-3">
                <Link
                  className="button button-outline w-full justify-center"
                  to={`/student/research/${researchId}`}
                >
                  Upload or revise manuscript
                </Link>
              </div>
            </section>
            {chapter && (
              <ChapterReviewPanel
                key={chapter.id}
                data={data}
                chapter={chapter}
                fileLabel={`Chapter${chapter.position}_${chapter.title.replace(/\W+/g, '_')}`}
                nameOf={nameOf}
                contentHeading="Your Content"
              />
            )}
          </div>
          {chapter && <RevisionHistory data={data} chapter={chapter} title="Submission History" />}
          <p className="text-xs text-slate-500">
            Last updated {schoolDate(research?.updated_at)} · Dates use Philippine time.
          </p>
        </>
      )}
    </div>
  );
}
