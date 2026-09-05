import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiFileText, FiUploadCloud } from 'react-icons/fi';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import {
  loadWorkspace,
  processDocument,
  retryDocument,
  rpc,
  saveChapters,
  signedDocument,
  uploadDocument
} from '../../../infrastructure/repositories/workflowRepository';
import { schoolDate, schoolInput, schoolToUTC } from '../../../domain/chapters.mjs';

function ChapterPreview({ result, chapters, onSave, busy }) {
  const [ranges, setRanges] = useState(() =>
    chapters.map((c) => {
      const detected = result.chapters.find((d) => d.position === c.position);
      return {
        chapter_id: c.id,
        expected_version: c.current_version_id,
        title: c.title,
        enabled: Boolean(detected),
        start_block: detected?.start_block ?? 0,
        end_block: detected?.end_block ?? 0
      };
    })
  );
  const [peek, setPeek] = useState(0);
  const update = (id, field, value) =>
    setRanges((rs) => rs.map((r) => (r.chapter_id === id ? { ...r, [field]: value } : r)));
  return (
    <section className="workspace-panel space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Check your chapter boundaries</h2>
        <p className="workspace-subtitle">
          {result.blocks.length} {result.unit}s found. Select the chapters to save and adjust their
          start and end {result.unit}s.
        </p>
      </div>
      {result.scanned && (
        <p className="notice">
          This PDF has no searchable text. Select physical page ranges and review the original PDF
          with your teacher.
        </p>
      )}
      {!result.chapters.length && (
        <p className="notice">
          No reliable chapter headings were found. Set the ranges manually using the document
          preview below.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="report-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Chapter</th>
              <th>Start {result.unit}</th>
              <th>End {result.unit}</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((range) => (
              <tr key={range.chapter_id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Include ${range.title}`}
                    checked={range.enabled}
                    onChange={(e) => update(range.chapter_id, 'enabled', e.target.checked)}
                  />
                </td>
                <td>{range.title}</td>
                {['start_block', 'end_block'].map((field) => (
                  <td key={field}>
                    <input
                      className="workspace-input min-w-20"
                      type="number"
                      min="1"
                      max={result.blocks.length}
                      aria-label={`${range.title} ${field === 'start_block' ? 'start' : 'end'}`}
                      value={range[field] + 1}
                      onChange={(e) => update(range.chapter_id, field, Number(e.target.value) - 1)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className="workspace-label" htmlFor="preview-block">
          Preview {result.unit}
        </label>
        <input
          id="preview-block"
          className="workspace-input max-w-32"
          type="number"
          min="1"
          max={result.blocks.length}
          value={peek + 1}
          onChange={(e) =>
            setPeek(Math.max(0, Math.min(result.blocks.length - 1, Number(e.target.value) - 1)))
          }
        />
        <pre className="chapter-content mt-3 max-h-52">
          {result.blocks[peek]?.text ||
            'No searchable text on this page. Use the original manuscript to check the range.'}
        </pre>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || !ranges.some((r) => r.enabled)}
          className="button button-outline"
          onClick={() =>
            onSave(
              ranges.filter((r) => r.enabled),
              false
            )
          }
        >
          Save chapter drafts
        </button>
        <button
          disabled={busy || !ranges.some((r) => r.enabled)}
          className="button button-navy"
          onClick={() =>
            onSave(
              ranges.filter((r) => r.enabled),
              true
            )
          }
        >
          Confirm and submit chapters
        </button>
      </div>
    </section>
  );
}
export function ResearchWorkspace() {
  const { id } = useParams();
  const { role, user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState('');
  const [comment, setComment] = useState('');
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [versionChoice, setVersionChoice] = useState('');
  const [viewer, setViewer] = useState(null);
  const [finalDocument, setFinalDocument] = useState('');
  const load = useCallback(async () => {
    try {
      const next = await loadWorkspace(id);
      setData(next);
      setSelected((s) => s || next.chapters[0]?.id || '');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const chapter = data?.chapters.find((c) => c.id === selected);
  const currentVersion = data?.versions.find((v) => v.id === chapter?.current_version_id);
  const version = data?.versions.find((v) => v.id === versionChoice) || currentVersion;
  const deadline = data?.deadlines.find((d) => d.chapter_id === selected);
  useEffect(() => {
    setDue(schoolInput(deadline?.due_at));
    setComment('');
    setReason('');
    setVersionChoice('');
    setViewer(null);
  }, [selected, deadline?.due_at]);
  async function act(fn, message) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setStage('');
    }
  }
  const owner = role === 'student' && data?.research.student_id === user?.id;
  const reviewer =
    ['teacher', 'admin'].includes(role) &&
    (role === 'admin' || data?.research.teacher_id === user?.id);
  const approved =
    data?.chapters.filter(
      (c) => data.versions.find((v) => v.id === c.current_version_id)?.status === 'approved'
    ).length || 0;
  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await act(async () => {
      setStage('Uploading original manuscript…');
      const documentId = await uploadDocument(id, file);
      setStage('Detecting chapters. Keep this page open…');
      const result = await processDocument(
        documentId,
        file,
        data.chapters.map((c) => c.title)
      );
      setPreview({ documentId, result });
    }, 'Document processed. Check the chapter boundaries before submitting.');
    await load();
  }
  async function openOriginal(path, format, start) {
    await act(async () => {
      const url = await signedDocument(path);
      setViewer({
        url: `${url}${format === 'pdf' && start != null ? `#page=${start + 1}` : ''}`,
        format
      });
    }, 'Original manuscript ready.');
  }
  if (error)
    return (
      <div className="workspace-panel">
        <p className="notice error-notice" role="alert">
          {error}
        </p>
        <button className="button button-outline mt-4" onClick={load}>
          Retry
        </button>
      </div>
    );
  if (!data)
    return (
      <div role="status" className="empty-panel">
        Loading research workspace…
      </div>
    );
  const research = data.research;
  const teacher = data.directory.find((p) => p.id === research.teacher_id);
  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-slate-500"
        to={`/${role}/progress`}
      >
        <FiArrowLeft />
        Research progress
      </Link>
      <section className="workspace-panel">
        <p className="eyebrow">RESEARCH WORKSPACE</p>
        <h1 className="workspace-heading mt-2">{research.title}</h1>
        <p className="workspace-subtitle">
          {research.authors.join(', ')} · {teacher?.full_name || 'Awaiting teacher assignment'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <span className={`status-pill status-${research.status}`}>
            {research.status.replaceAll('_', ' ')}
          </span>
          <p className="text-sm text-slate-600">
            {data.chapters.length
              ? `${approved} of ${data.chapters.length} chapters approved`
              : 'Legacy research · chapter progress not assessed'}
          </p>
        </div>
        <div className="progress-track">
          <div
            style={{
              width: `${data.chapters.length ? (approved / data.chapters.length) * 100 : 0}%`
            }}
          />
        </div>
      </section>
      {owner && research.status === 'rejected' && (
        <section className="workspace-panel space-y-3">
          <h2 className="font-bold text-slate-800">This research was rejected</h2>
          <p className="workspace-subtitle">
            Review the reviewer's comments below, then resubmit to send this same research back
            for review. Resubmitting keeps your existing title, chapters, and comment history.
          </p>
          <button
            className="button button-navy"
            disabled={busy}
            onClick={() =>
              act(
                () => rpc('workflow_resubmit', { p_research: id }),
                'Research resubmitted. You can upload a revised manuscript now.'
              )
            }
          >
            Resubmit this research
          </button>
        </section>
      )}
      {owner && research.workflow_enabled && research.status !== 'rejected' && (
        <section className="workspace-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800">Manuscripts & revisions</h2>
              <p className="workspace-subtitle">
                PDF or DOCX · up to 50 MiB · previous versions stay available
              </p>
            </div>
            <label className={`button button-navy ${busy ? 'opacity-50' : ''}`}>
              <FiUploadCloud />
              Upload manuscript
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.docx"
                disabled={busy}
                onChange={handleUpload}
              />
            </label>
          </div>
          {stage && (
            <p role="status" className="notice mt-4">
              {stage}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {data.documents.map((doc) => {
              const job = data.jobs.find((j) => j.document_id === doc.id);
              return (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 text-xs"
                >
                  <FiFileText />
                  <span className="flex-1">
                    {doc.format.toUpperCase()} · {schoolDate(doc.created_at)}{' '}
                    <span className="status-pill">{job?.state}</span>
                    {job?.error && <span className="block mt-2 text-red-700">{job.error}</span>}
                  </span>
                  <button
                    className="text-green-800 font-semibold"
                    disabled={busy}
                    onClick={() => openOriginal(doc.file_path, doc.format)}
                  >
                    Original
                  </button>
                  {job?.result ? (
                    <button
                      className="text-green-800 font-semibold"
                      onClick={() => setPreview({ documentId: doc.id, result: job.result })}
                    >
                      Map chapters
                    </button>
                  ) : (
                    <button
                      disabled={busy || job?.attempts >= 3}
                      className="text-green-800 font-semibold"
                      onClick={() =>
                        act(async () => {
                          setStage('Retrying chapter detection…');
                          const result = await retryDocument(
                            doc,
                            data.chapters.map((c) => c.title)
                          );
                          setPreview({ documentId: doc.id, result });
                        }, 'Document processed.')
                      }
                    >
                      Retry processing
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {data.versions.some(
            (v) => v.status === 'draft' && data.chapters.some((c) => c.current_version_id === v.id)
          ) && (
            <button
              className="button button-outline mt-4"
              disabled={busy}
              onClick={() =>
                act(
                  () => rpc('workflow_submit_drafts', { p_research: id }),
                  'Draft chapters submitted.'
                )
              }
            >
              Submit saved drafts
            </button>
          )}
        </section>
      )}
      {preview && owner && (
        <ChapterPreview
          key={preview.documentId + data.versions.length}
          result={preview.result}
          chapters={data.chapters}
          busy={busy}
          onSave={(ranges, submit) =>
            act(
              async () => {
                await saveChapters(
                  id,
                  preview.documentId,
                  ranges,
                  preview.result.blocks.length,
                  submit
                );
                setPreview(null);
              },
              submit ? 'Chapters sent to your teacher.' : 'Chapter drafts saved.'
            )
          }
        />
      )}
      {data.chapters.length > 0 && (
        <div className="chapter-workspace">
          <nav aria-label="Research chapters">
            {data.chapters.map((c) => {
              const v = data.versions.find((v) => v.id === c.current_version_id);
              return (
                <button
                  key={c.id}
                  className={`chapter-tab ${selected === c.id ? 'selected' : ''}`}
                  aria-pressed={selected === c.id}
                  onClick={() => setSelected(c.id)}
                >
                  <strong>
                    {c.position}. {c.title}
                  </strong>
                  <span className={`status-pill status-${v?.status}`}>
                    {v?.status.replaceAll('_', ' ') || 'Not submitted'}
                  </span>
                </button>
              );
            })}
          </nav>
          <section className="workspace-panel space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{chapter?.title}</h2>
              <p className="workspace-subtitle">
                Deadline: {schoolDate(deadline?.due_at)} (Philippine time)
              </p>
            </div>
            {version ? (
              <>
                <label className="workspace-label">
                  Version history
                  <select
                    className="workspace-input mt-2"
                    value={version.id}
                    onChange={(e) => {
                      setVersionChoice(e.target.value);
                      setViewer(null);
                    }}
                  >
                    {data.versions
                      .filter((v) => v.chapter_id === selected)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          Version {v.version_number} · {v.status.replaceAll('_', ' ')} ·{' '}
                          {schoolDate(v.created_at)}
                          {v.id === currentVersion?.id ? ' · Current' : ''}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`status-pill status-${version.status}`}>
                    {version.status.replaceAll('_', ' ')}
                  </span>
                  <button
                    className="text-sm font-semibold text-green-800"
                    disabled={busy}
                    onClick={() => {
                      const doc = data.documents.find((d) => d.id === version.document_id);
                      if (doc) openOriginal(doc.file_path, doc.format, version.start_block);
                    }}
                  >
                    View original manuscript
                  </button>
                </div>
                <div className="chapter-content">
                  {version.content ||
                    'This chapter uses scanned pages. Open the original manuscript to review it.'}
                </div>
                <section>
                  <h3 className="font-semibold text-slate-800 mb-3">Feedback on this version</h3>
                  {data.reviews.filter((r) => r.version_id === version.id).length ? (
                    data.reviews
                      .filter((r) => r.version_id === version.id)
                      .map((review) => (
                        <article key={review.id} className="rounded-lg bg-slate-50 p-4 mb-3">
                          <p className="text-xs text-slate-500">
                            {review.decision.replaceAll('_', ' ')} · {schoolDate(review.created_at)}
                          </p>
                          <p className="mt-2 text-sm whitespace-pre-wrap">
                            {review.comment || 'Chapter approved.'}
                          </p>
                        </article>
                      ))
                  ) : (
                    <p className="text-sm text-slate-500">No feedback on this version yet.</p>
                  )}
                </section>
              </>
            ) : (
              <div className="empty-panel">This chapter has not been submitted yet.</div>
            )}
            {reviewer &&
              version?.id === currentVersion?.id &&
              version?.status !== 'draft' &&
              version && (
                <div className="space-y-3 border-t pt-5">
                  <label className="workspace-label">
                    Review feedback
                    <textarea
                      className="workspace-input mt-2"
                      rows="4"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Explain your feedback or requested changes…"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['feedback', 'Add feedback'],
                      ['needs_revision', 'Request revision'],
                      ['approved', 'Approve chapter']
                    ].map(([decision, label]) => (
                      <button
                        key={decision}
                        className={`button ${decision === 'approved' ? 'button-navy' : 'button-outline'}`}
                        disabled={
                          busy || (decision !== 'feedback' && version.status !== 'submitted')
                        }
                        onClick={() =>
                          act(async () => {
                            await rpc('workflow_review', {
                              p_version: version.id,
                              p_decision: decision,
                              p_comment: comment
                            });
                            setComment('');
                          }, 'Review saved.')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            {reviewer && chapter && (
              <form
                className="border-t pt-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    () =>
                      rpc('workflow_deadline', {
                        p_chapter: chapter.id,
                        p_due: schoolToUTC(due),
                        p_reason: reason
                      }),
                    'Deadline saved.'
                  );
                }}
              >
                <h3 className="font-semibold">Chapter deadline</h3>
                <label className="workspace-label">
                  Due date and time (Philippines)
                  <input
                    className="workspace-input mt-2"
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <input
                  className="workspace-input"
                  aria-label="Reason for deadline change"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for setting or changing the deadline"
                />
                <button className="button button-outline" disabled={busy}>
                  Save deadline
                </button>
                <p className="text-xs text-slate-500">
                  Leave the date blank to remove the deadline.
                </p>
              </form>
            )}
            {data.deadlineHistory.filter((h) => h.chapter_id === selected).length > 0 && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer">Deadline history</summary>
                {data.deadlineHistory
                  .filter((h) => h.chapter_id === selected)
                  .map((h) => (
                    <p key={h.id} className="mt-2">
                      {schoolDate(h.due_at)} · {h.reason} · changed {schoolDate(h.created_at)}
                    </p>
                  ))}
              </details>
            )}
          </section>
        </div>
      )}
      {viewer && (
        <section className="workspace-panel space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">Original manuscript</h2>
            <button onClick={() => setViewer(null)} className="text-sm text-slate-500">
              Close preview
            </button>
          </div>
          <a className="button button-outline" href={viewer.url} target="_blank" rel="noreferrer">
            Open original file
          </a>
          {viewer.format === 'pdf' && (
            <iframe
              title="Original research manuscript"
              src={viewer.url}
              className="w-full h-[650px] border rounded"
            />
          )}
          <p className="text-xs text-slate-500">
            The access link expires after five minutes. Reopen the original to refresh it.
          </p>
        </section>
      )}
      {reviewer && (
        <section className="workspace-panel space-y-4">
          <h2 className="font-bold text-slate-800">Final research decision</h2>
          <p className="workspace-subtitle">
            Publish after all required chapters are approved from the same final manuscript.
            Existing published research stays available during revisions.
          </p>
          {research.workflow_enabled && (
            <label className="workspace-label">
              Final manuscript
              <select
                className="workspace-input mt-2"
                value={finalDocument}
                onChange={(e) => setFinalDocument(e.target.value)}
              >
                <option value="">Select final manuscript</option>
                {data.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.format.toUpperCase()} · {schoolDate(d.created_at)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="button button-navy"
            disabled={
              busy ||
              (research.workflow_enabled && (!finalDocument || approved !== data.chapters.length))
            }
            onClick={() =>
              act(
                () =>
                  rpc('workflow_publish', { p_research: id, p_document: finalDocument || null }),
                'Research approved for the library.'
              )
            }
          >
            Approve final research
          </button>
          <details>
            <summary className="text-sm text-slate-600 cursor-pointer">
              Reject this research
            </summary>
            <p className="text-xs text-slate-500 mt-3">
              Rejecting removes the research from the approved library. Use chapter revision
              requests for work that can be improved.
            </p>
            <textarea
              className="workspace-input mt-3"
              aria-label="Rejection reason"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              disabled={busy || !comment.trim()}
              className="button button-outline mt-3"
              onClick={() =>
                act(
                  () =>
                    rpc('workflow_research_review', {
                      p_research: id,
                      p_status: 'rejected',
                      p_comment: comment
                    }),
                  'Research rejected.'
                )
              }
            >
              Reject with explanation
            </button>
          </details>
        </section>
      )}
    </div>
  );
}
