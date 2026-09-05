import { useEffect, useMemo, useState } from 'react';
import { loadReportData } from '../../../infrastructure/repositories/workflowRepository';
import { schoolDate, csvCell } from '../../../domain/chapters.mjs';

function groupCount(items, key) {
  const counts = {};
  items.forEach((item) => {
    const value = item[key] || 'Unspecified';
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function downloadCSV(filename, rows) {
  const url = URL.createObjectURL(
    new Blob(['﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BreakdownCard({ title, rows }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          rows.map(([label, count]) => (
            <div className="flex items-center justify-between text-sm" key={label}>
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold text-slate-900">{count}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [researches, setResearches] = useState([]);
  const [activity, setActivity] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await loadReportData();
      setResearches(data.researches);
      setActivity(data.activity);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byYear = useMemo(() => groupCount(researches, 'year'), [researches]);
  const byStrand = useMemo(() => groupCount(researches, 'strand'), [researches]);
  const byStatus = useMemo(() => groupCount(researches, 'status'), [researches]);
  const byTeacher = useMemo(() => groupCount(researches, 'teacherName'), [researches]);

  const exportStatsCSV = () => {
    const rows = [['Breakdown', 'Value', 'Count']];
    byYear.forEach(([value, count]) => rows.push(['School Year', value, count]));
    byStrand.forEach(([value, count]) => rows.push(['Strand', value, count]));
    byStatus.forEach(([value, count]) => rows.push(['Status', value, count]));
    byTeacher.forEach(([value, count]) => rows.push(['Teacher', value, count]));
    downloadCSV(`research-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const exportActivityCSV = () => {
    const rows = [['Date', 'Actor', 'Event', 'Message']];
    activity.forEach((entry) =>
      rows.push([schoolDate(entry.created_at), entry.actorName, entry.event_key, entry.message])
    );
    downloadCSV(`activity-log-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading) {
    return <div className="rounded-2xl bg-white p-6 shadow-card">Loading reports…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <p className="text-sm text-red-700">{error}</p>
        <button className="button button-outline mt-4" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">
            Submission statistics and the recent activity log.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={exportStatsCSV}
          >
            Export statistics (CSV)
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={exportActivityCSV}
          >
            Export activity log (CSV)
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BreakdownCard title="By School Year" rows={byYear} />
        <BreakdownCard title="By Strand" rows={byStrand} />
        <BreakdownCard title="By Status" rows={byStatus} />
        <BreakdownCard title="By Teacher" rows={byTeacher} />
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Recent Activity</h3>
          <p className="text-xs text-slate-500">Most recent 200 events.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={4}>
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                activity.map((entry) => (
                  <tr className="border-b border-slate-100" key={entry.id}>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {schoolDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.actorName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{entry.event_key}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
