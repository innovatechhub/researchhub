import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { rpc } from '../../../infrastructure/repositories/workflowRepository';
import { completion, csvCell, schoolDate } from '../../../domain/chapters.mjs';

export function ProgressPage({ deadlinesOnly = false }) {
  const { role } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [since, setSince] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
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
    load();
  }, [load]);
  const visible = useMemo(
    () =>
      records.filter(
        (r) =>
          `${r.title} ${r.student_name || ''}`.toLowerCase().includes(search.toLowerCase()) &&
          (filter === 'all' ||
            (filter === 'overdue'
              ? Number(r.overdue_count) > 0
              : filter === 'awaiting'
                ? Number(r.awaiting_count) > 0
                : r.status === filter)) &&
          (!since || new Date(r.updated_at) >= new Date(`${since}T00:00:00+08:00`))
      ),
    [records, search, filter, since]
  );
  function exportCSV() {
    const lines = [
      [
        'Research progress report',
        schoolDate(new Date()),
        `Search: ${search}`,
        `Status: ${filter}`,
        `Updated since: ${since || 'Any'}`
      ],
      [
        'Student',
        'Research',
        'Status',
        'Approved chapters',
        'Required chapters',
        'Completion %',
        'Awaiting review',
        'Overdue',
        'Late',
        'Next deadline'
      ],
      ...visible.map((r) => [
        r.student_name,
        r.title,
        r.status,
        r.approved_count,
        r.required_count,
        completion(r) ?? 'Not assessed',
        r.awaiting_count,
        r.overdue_count,
        r.late_count,
        schoolDate(r.next_deadline)
      ])
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8'
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research-progress.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="workspace-heading">
            {deadlinesOnly ? 'Submission deadlines' : 'Research progress'}
          </h1>
          <p className="workspace-subtitle">
            Chapter completion, feedback, and deadlines in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button className="button button-outline" onClick={() => window.print()}>
            Print report
          </button>
          <button className="button button-outline" onClick={exportCSV} disabled={!visible.length}>
            Export CSV
          </button>
          {role === 'student' && (
            <Link className="button button-navy" to="/student/submit">
              New research
            </Link>
          )}
        </div>
      </div>
      <p className="print-only">
        Generated {schoolDate(new Date())} · Search: {search || 'All'} · Status: {filter} · Updated
        since: {since || 'Any'}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Research projects', records.length],
          ['Awaiting chapter review', records.reduce((n, r) => n + Number(r.awaiting_count), 0)],
          ['Overdue chapters', records.reduce((n, r) => n + Number(r.overdue_count), 0)]
        ].map(([label, value]) => (
          <div className="workspace-panel" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-3xl font-bold text-[#08264d] mt-2">{value}</p>
          </div>
        ))}
      </div>
      <section className="workspace-panel">
        <div className="flex flex-wrap gap-4 mb-5 no-print">
          <label className="flex-1 min-w-40 workspace-label">
            Search student or research
            <input
              className="workspace-input mt-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
            />
          </label>
          <label className="workspace-label">
            Status
            <select
              className="workspace-input mt-2"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {[
                ['all', 'All research'],
                ['awaiting', 'Awaiting review'],
                ['overdue', 'Overdue'],
                ['draft', 'Draft'],
                ['approved', 'Approved'],
                ['rejected', 'Rejected']
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace-label">
            Updated since
            <input
              className="workspace-input mt-2"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <p role="status" className="empty-panel">
            Loading progress…
          </p>
        ) : error ? (
          <p className="notice error-notice" role="alert">
            {error}
            <button className="ml-3 underline" onClick={load}>
              Retry
            </button>
          </p>
        ) : !visible.length ? (
          <p className="empty-panel">No research matches this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Student / Research</th>
                  <th>Completion</th>
                  <th>Awaiting review</th>
                  <th>Overdue / Late</th>
                  <th>Next deadline</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        className="font-semibold text-[#08264d] hover:underline"
                        to={`/${role}/research/${r.id}`}
                      >
                        {r.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.student_name || 'Student'} · {r.status}
                      </p>
                    </td>
                    <td className="min-w-36">
                      {completion(r) === null ? (
                        'Not assessed'
                      ) : (
                        <>
                          <span>
                            {r.approved_count}/{r.required_count} approved · {completion(r)}%
                          </span>
                          <div className="progress-track">
                            <div style={{ width: `${completion(r)}%` }} />
                          </div>
                        </>
                      )}
                    </td>
                    <td>{r.awaiting_count}</td>
                    <td>
                      <span className={Number(r.overdue_count) ? 'text-red-700 font-semibold' : ''}>
                        {r.overdue_count} overdue
                      </span>
                      <p className="text-xs text-slate-500">{r.late_count} submitted late</p>
                    </td>
                    <td>
                      {schoolDate(r.next_deadline)}
                      <Link
                        className="block text-green-800 text-xs mt-2 no-print"
                        to={`/${role}/research/${r.id}`}
                      >
                        {deadlinesOnly ? 'Manage chapter deadlines' : 'Open workspace'} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-5 text-xs text-slate-500">
          Completion counts approved current chapters. A timely submission awaiting teacher review
          is not overdue. All dates use Philippine time.
        </p>
      </section>
    </div>
  );
}
