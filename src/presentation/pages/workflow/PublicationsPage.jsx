import { useEffect, useState } from 'react';
import { rows, rpc } from '../../../infrastructure/repositories/workflowRepository';
import { useToast } from '../../../app/providers/ToastProvider';
export function PublicationsPage() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function load() {
    try {
      setRecords(
        await rows('researches', (q) =>
          q.eq('status', 'approved').order('reviewed_at', { ascending: false })
        )
      );
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="workspace-heading">Public research previews</h1>
        <p className="workspace-subtitle">
          Choose which approved research metadata appears on the public homepage and catalogue.
        </p>
      </div>
      <div className="notice">
        Only the title, authors, abstract excerpt, category, strand, year, and publication date are
        shared. Manuscripts and internal feedback remain private.
      </div>
      {error && (
        <p role="alert" className="notice error-notice">
          {error}
          <button onClick={load} className="ml-3 underline">
            Retry
          </button>
        </p>
      )}
      <section className="workspace-panel">
        {records.length ? (
          records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 border-b py-4">
              <div>
                <h2 className="font-semibold text-slate-800">{r.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {r.authors.join(', ')} · {r.year}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  disabled={busy === r.id}
                  checked={r.public_preview_enabled}
                  onChange={async (e) => {
                    setBusy(r.id);
                    try {
                      await rpc('workflow_preview', {
                        p_research: r.id,
                        p_enabled: e.target.checked
                      });
                      await load();
                      toast.success('Public preview updated.');
                    } catch (err) {
                      toast.error(err.message);
                    } finally {
                      setBusy('');
                    }
                  }}
                />
                Public preview
              </label>
            </div>
          ))
        ) : (
          <p className="empty-panel">Approved research will appear here for publication review.</p>
        )}
      </section>
    </div>
  );
}
