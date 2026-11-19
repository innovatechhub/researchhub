import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rows, rpc } from '../../../infrastructure/repositories/workflowRepository';
import { useToast } from '../../../app/providers/ToastProvider';
import { useAuth } from '../../../app/providers/AuthProvider';

export function NewResearchPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, user } = useAuth();
  const [reused, setReused] = useState(false);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    abstract: '',
    authors: profile?.full_name || '',
    keywords: '',
    strand: profile?.track || '',
    category: '',
    year: new Date().getFullYear(),
    teacher: ''
  });
  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const load = async () => {
    try {
      const [people, strands, categories] = await Promise.all([
        rpc('workflow_directory'),
        rows('strands', (q) => q.order('name')),
        rows('research_categories', (q) => q.order('name'))
      ]);
      setOptions({
        teachers: people.filter((p) => ['teacher', 'reviewer'].includes(p.role)),
        strands,
        categories
      });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      authors: f.authors || profile.full_name || '',
      strand: f.strand || profile.track || ''
    }));
  }, [profile]);
  // Students enter their details once: a new research starts from their latest one, and only
  // the title and abstract are left blank.
  useEffect(() => {
    if (!user?.id) return undefined;
    let live = true;
    rows('researches', (q) =>
      q.eq('student_id', user.id).order('created_at', { ascending: false }).limit(1)
    )
      .then(([last]) => {
        if (!live || !last) return;
        setReused(true);
        setForm((f) => ({
          ...f,
          authors: f.authors || (last.authors || []).join(', '),
          keywords: f.keywords || (last.keywords || []).join(', '),
          strand: f.strand || last.strand || '',
          category: f.category || last.category || '',
          teacher: f.teacher || last.teacher_id || ''
        }));
      })
      .catch(() => {}); // Pre-filling is a convenience; the form still works without it.
    return () => {
      live = false;
    };
  }, [user?.id]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await rpc('workflow_create', {
        p_teacher: form.teacher,
        p_metadata: {
          ...form,
          authors: form.authors
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          keywords: form.keywords
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          year: Number(form.year)
        }
      });
      toast.success('Research draft created. Upload your manuscript to continue.');
      navigate(`/student/research/${id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="workspace-heading">Start your research submission</h1>
          <p className="workspace-subtitle">
            Add your research details, then upload and check your chapters.
          </p>
        </div>
        <Link className="button button-outline" to="/student/progress">
          My research
        </Link>
      </div>
      {error && (
        <div className="notice error-notice" role="alert">
          {error}
          <button className="ml-3 underline" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {reused && (
        <p className="notice">
          We filled in your details from your previous research. Add the new title and abstract, and
          change anything that is different. To send a revision of research you already submitted,
          open it from My Research instead.
        </p>
      )}
      {options && !options.teachers.length && (
        <p className="notice">
          No teacher is assigned to your account yet. Ask the school administrator to add your
          teacher assignment. You can prepare the form while waiting.
        </p>
      )}
      <form className="workspace-panel space-y-5" onSubmit={submit}>
        <label className="workspace-label">
          Research title
          <input
            className="workspace-input mt-2"
            name="title"
            value={form.title}
            onChange={update}
            required
            maxLength="500"
            placeholder="Give your research a clear, descriptive title"
          />
        </label>
        <label className="workspace-label">
          Abstract
          <textarea
            className="workspace-input mt-2"
            name="abstract"
            value={form.abstract}
            onChange={update}
            required
            rows="6"
            placeholder="Summarize your research purpose, approach, and findings"
          />
        </label>
        <div className="form-grid">
          <label className="workspace-label">
            Authors (separated by commas)
            <input
              className="workspace-input mt-2"
              name="authors"
              value={form.authors}
              onChange={update}
              required
            />
          </label>
          <label className="workspace-label">
            Keywords (separated by commas)
            <input
              className="workspace-input mt-2"
              name="keywords"
              value={form.keywords}
              onChange={update}
            />
          </label>
          {[
            ['strand', 'Strand', options?.strands],
            ['category', 'Category', options?.categories],
            ['teacher', 'Assigned teacher', options?.teachers]
          ].map(([name, label, items]) => (
            <label className="workspace-label" key={name}>
              {label}
              <select
                aria-label={label}
                className="workspace-input mt-2"
                name={name}
                required
                value={form[name]}
                onChange={update}
              >
                <option value="">Select {label.toLowerCase()}</option>
                {items?.map((item) => (
                  <option key={item.id} value={name === 'teacher' ? item.id : item.name}>
                    {item.name || item.full_name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="workspace-label">
            Research year
            <input
              className="workspace-input mt-2"
              name="year"
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              value={form.year}
              onChange={update}
              required
            />
          </label>
        </div>
        <p className="notice">
          Your work starts as a private draft. On the next screen, upload a PDF or DOCX manuscript
          up to 50 MiB, confirm chapter boundaries, and submit chapters to your selected teacher.
        </p>
        <button className="button button-navy" disabled={busy || !options?.teachers.length}>
          {busy ? 'Creating draft…' : 'Save draft & continue'}
        </button>
      </form>
    </div>
  );
}
