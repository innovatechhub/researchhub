import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { rows, rpc } from '../../../infrastructure/repositories/workflowRepository';

export function AssignmentsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [teacher, setTeacher] = useState('');
  const [student, setStudent] = useState('');
  const [period, setPeriod] = useState(
    `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`
  );
  const [reassign, setReassign] = useState({ research: '', teacher: '', reason: '' });
  const [template, setTemplate] = useState('');
  const load = useCallback(async () => {
    try {
      const [people, assignments, researches, settings] = await Promise.all([
        rpc('workflow_directory'),
        rows('teacher_student_assignments', (q) => q.order('created_at', { ascending: false })),
        rpc('workflow_progress'),
        rows('workflow_settings')
      ]);
      setData({ people, assignments, researches });
      setTemplate(settings[0].chapter_template.join('\n'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const name = (id) => data?.people.find((p) => p.id === id)?.full_name || 'School user';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="workspace-heading">
          {role === 'admin' ? 'Teacher assignments' : 'Assigned students'}
        </h1>
        <p className="workspace-subtitle">
          {role === 'admin'
            ? 'Pair students with research teachers and manage responsible reviewers.'
            : 'Your research students, including those who have not submitted yet.'}
        </p>
      </div>
      {error ? (
        <p role="alert" className="notice error-notice">
          {error}
          <button className="ml-3 underline" onClick={load}>
            Retry
          </button>
        </p>
      ) : !data ? (
        <p role="status">Loading assignments…</p>
      ) : (
        <>
          {role === 'admin' && (
            <form
              className="workspace-panel space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                act(
                  () =>
                    rpc('workflow_assign', {
                      p_teacher: teacher,
                      p_student: student,
                      p_period: period
                    }),
                  'Assignment saved.'
                );
              }}
            >
              <h2 className="font-semibold">Assign a student</h2>
              <div className="form-grid">
                {[
                  ['Teacher', teacher, setTeacher, ['teacher', 'reviewer']],
                  ['Student', student, setStudent, ['student']]
                ].map(([label, value, set, roles]) => (
                  <label key={label} className="workspace-label">
                    {label}
                    <select
                      className="workspace-input mt-2"
                      required
                      value={value}
                      onChange={(e) => set(e.target.value)}
                    >
                      <option value="">Select {label.toLowerCase()}</option>
                      {data.people
                        .filter((p) => roles.includes(p.role))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <label className="workspace-label">
                  Academic period
                  <input
                    className="workspace-input mt-2"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    required
                  />
                </label>
              </div>
              <button className="button button-navy" disabled={busy}>
                Save assignment
              </button>
            </form>
          )}
          <section className="workspace-panel">
            <div className="overflow-x-auto">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    {role === 'admin' && <th>Teacher</th>}
                    <th>Academic period</th>
                    <th>Research</th>
                    {role === 'admin' && <th>Assignment</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.assignments
                    .filter((a) => a.active)
                    .map((a) => (
                      <tr key={a.id}>
                        <td>{name(a.student_id)}</td>
                        {role === 'admin' && <td>{name(a.teacher_id)}</td>}
                        <td>{a.academic_period}</td>
                        <td>
                          {data.researches
                            .filter(
                              (r) => r.student_id === a.student_id && r.teacher_id === a.teacher_id
                            )
                            .map((r) => (
                              <Link
                                key={r.id}
                                className="block text-green-800 mb-2"
                                to={`/${role}/research/${r.id}`}
                              >
                                {r.title} →
                              </Link>
                            ))}
                          {!data.researches.some(
                            (r) => r.student_id === a.student_id && r.teacher_id === a.teacher_id
                          ) && <span className="text-slate-400">No research submitted</span>}
                        </td>
                        {role === 'admin' && (
                          <td>
                            <button
                              disabled={busy}
                              className="text-sm text-red-700"
                              onClick={() =>
                                act(
                                  () =>
                                    rpc('workflow_assign', {
                                      p_teacher: a.teacher_id,
                                      p_student: a.student_id,
                                      p_period: a.academic_period,
                                      p_active: false
                                    }),
                                  'Assignment deactivated.'
                                )
                              }
                            >
                              Deactivate
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data.assignments.some((a) => a.active) && (
              <p className="empty-panel">No active assignments yet.</p>
            )}
          </section>
          {role === 'admin' && (
            <>
              <form
                className="workspace-panel space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    () =>
                      rpc('workflow_reassign', {
                        p_research: reassign.research,
                        p_teacher: reassign.teacher,
                        p_reason: reassign.reason
                      }),
                    'Research reassigned.'
                  );
                }}
              >
                <h2 className="font-semibold">Assign or reassign existing research</h2>
                <p className="workspace-subtitle">
                  Legacy records without a teacher remain visible to administrators until assigned.
                </p>
                <div className="form-grid">
                  <label className="workspace-label">
                    Research
                    <select
                      className="workspace-input mt-2"
                      required
                      value={reassign.research}
                      onChange={(e) => setReassign((r) => ({ ...r, research: e.target.value }))}
                    >
                      <option value="">Select research</option>
                      {data.researches.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.teacher_id ? '' : 'Unassigned · '}
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="workspace-label">
                    New teacher
                    <select
                      className="workspace-input mt-2"
                      required
                      value={reassign.teacher}
                      onChange={(e) => setReassign((r) => ({ ...r, teacher: e.target.value }))}
                    >
                      <option value="">Select teacher</option>
                      {data.people
                        .filter((p) => ['teacher', 'reviewer'].includes(p.role))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <input
                  className="workspace-input"
                  aria-label="Reassignment reason"
                  placeholder="Reason for reassignment"
                  required
                  value={reassign.reason}
                  onChange={(e) => setReassign((r) => ({ ...r, reason: e.target.value }))}
                />
                <button className="button button-outline" disabled={busy}>
                  Reassign research
                </button>
              </form>
              <form
                className="workspace-panel space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    () =>
                      rpc('workflow_template', {
                        p_titles: template
                          .split('\n')
                          .map((t) => t.trim())
                          .filter(Boolean)
                      }),
                    'Template updated for new research.'
                  );
                }}
              >
                <h2 className="font-semibold">Chapter template</h2>
                <p className="workspace-subtitle">
                  One required chapter title per line. Changes apply to newly created research;
                  existing chapter structures stay intact.
                </p>
                <textarea
                  className="workspace-input"
                  aria-label="Chapter template"
                  rows="6"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  required
                />
                <button className="button button-outline" disabled={busy}>
                  Save template
                </button>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}
