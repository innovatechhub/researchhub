import { useCallback, useEffect, useState } from 'react';
import {
  createResearchCategoryUseCase,
  deleteResearchCategoryUseCase,
  listResearchCategoriesUseCase
} from '../../../application/usecases/adminUseCases';
import { useToast } from '../../../app/providers/ToastProvider';
import { formatDate } from '../../../core/utils/date';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export function CategoryPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [creating, setCreating] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const data = await listResearchCategoriesUseCase();
      setCategories(data);
    } catch (error) {
      toast.error(error.message || 'Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleOpenAddModal = () => {
    setNewCategoryName('');
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    if (creating) {
      return;
    }

    setIsAddModalOpen(false);
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();
    const trimmed = newCategoryName.trim();

    if (!trimmed) {
      return;
    }

    setCreating(true);
    try {
      await createResearchCategoryUseCase({ name: trimmed });
      toast.success('Category added successfully.');
      setIsAddModalOpen(false);
      setNewCategoryName('');
      await loadCategories();
    } catch (error) {
      toast.error(error.message || 'Unable to add category.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    const confirmed = window.confirm(`Delete category${name ? ` (${name})` : ''}?`);
    if (!confirmed) {
      return;
    }

    setDeletingCategoryId(id);
    try {
      await deleteResearchCategoryUseCase(id);
      toast.success('Category deleted successfully.');
      await loadCategories();
    } catch (error) {
      toast.error(error.message || 'Unable to delete category.');
    } finally {
      setDeletingCategoryId('');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card" id="admin-categories">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Category Management</h2>
        <button
          type="button"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleOpenAddModal}
          disabled={creating}
        >
          Add Category
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-[640px] w-full border-collapse text-left">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Created At</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-sm text-slate-500" colSpan={3}>
                  No categories found.
                </td>
              </tr>
            ) : (
              categories.map((entry) => (
                <tr className="border-b border-slate-100" key={entry.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{entry.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deletingCategoryId === entry.id}
                      onClick={() => handleDeleteCategory(entry.id, entry.name)}
                    >
                      {deletingCategoryId === entry.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add Category</h3>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                onClick={handleCloseAddModal}
                disabled={creating}
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleAddCategory}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  required
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleCloseAddModal}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
