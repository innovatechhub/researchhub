import { useState } from 'react';
import { useToast } from '../../../app/providers/ToastProvider';
import { TextField } from '../common/TextField';

export function ResearchSubmissionForm({
  onSubmit,
  submitting,
  strandOptions = [],
  categoryOptions = []
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [authorsText, setAuthorsText] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [strand, setStrand] = useState('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const hasStrands = strandOptions.length > 0;
  const hasCategories = categoryOptions.length > 0;
  const disableSubmit = submitting || !hasStrands || !hasCategories;

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    try {
      await onSubmit({ title, abstract, authorsText, keywordsText, strand, category, year, file });
      setTitle('');
      setAbstract('');
      setAuthorsText('');
      setKeywordsText('');
      setStrand('');
      setCategory('');
      setYear(new Date().getFullYear());
      setFile(null);
      event.target.reset();
    } catch (error) {
      toast.error(error.message || 'Unable to submit research.');
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleFormSubmit}>
      <TextField
        id="research-title"
        label="Research Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Impact of Smart Libraries on Student Productivity"
        required
      />

      <TextField
        id="research-abstract"
        type="textarea"
        label="Abstract"
        value={abstract}
        onChange={(event) => setAbstract(event.target.value)}
        placeholder="Write a concise abstract of your research..."
        required
        rows={6}
      />

      <TextField
        id="research-authors"
        label="Authors (comma separated)"
        value={authorsText}
        onChange={(event) => setAuthorsText(event.target.value)}
        placeholder="Juan Dela Cruz, Maria Santos"
        required
      />

      <TextField
        id="research-keywords"
        label="Keywords (comma separated)"
        value={keywordsText}
        onChange={(event) => setKeywordsText(event.target.value)}
        placeholder="smart library, student productivity, campus systems"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2" htmlFor="research-strand">
          <span className="text-sm font-medium text-slate-700">Strand</span>
          <select
            id="research-strand"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100 disabled:text-slate-500"
            value={strand}
            onChange={(event) => setStrand(event.target.value)}
            required
            disabled={!hasStrands}
          >
            <option value="">{hasStrands ? 'Select strand' : 'No strands available'}</option>
            {strandOptions.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2" htmlFor="research-category">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            id="research-category"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100 disabled:text-slate-500"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            disabled={!hasCategories}
          >
            <option value="">{hasCategories ? 'Select category' : 'No categories available'}</option>
            {categoryOptions.map((entry) => (
              <option key={entry.id} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hasStrands || !hasCategories ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Ask the admin to add at least one strand and category before submitting research.
        </p>
      ) : null}

      <TextField
        id="research-year"
        type="number"
        label="Year"
        value={year}
        onChange={(event) => setYear(event.target.value)}
        placeholder="2026"
        required
      />

      <label className="block space-y-2" htmlFor="research-file">
        <span className="text-sm font-medium text-slate-700">Research File (PDF or Word)</span>
        <input
          className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:font-medium file:text-brand-800"
          id="research-file"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="pt-1">
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disableSubmit}
        >
          {submitting ? 'Submitting...' : 'Submit Research'}
        </button>
      </div>
    </form>
  );
}
