import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  cleanRejectedResearchRecordsUseCase,
  createResearchCategoryUseCase,
  createStrandUseCase,
  createTrackUseCase,
  deleteResearchCategoryUseCase,
  deleteStrandUseCase,
  deleteTrackUseCase,
  exportBackupUseCase,
  getAdminDashboardStatsUseCase,
  listResearchCategoriesUseCase,
  listStrandsUseCase,
  listTracksUseCase,
  listUsersUseCase,
  updateUserUseCase
} from '../../../application/usecases/adminUseCases';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../../../core/constants/routes';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'researcher', label: 'Researcher' }
];

function toLocalFileTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function AdminDashboardPage() {
  const { hasSupabaseConfig, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const isUserManagementRoute = location.pathname === ROUTES.adminUserManagement;
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalResearchSubmissions: 0,
    pendingApprovals: 0,
    approvedResearch: 0
  });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [strands, setStrands] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newStrandName, setNewStrandName] = useState('');
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackStrandId, setNewTrackStrandId] = useState('');

  const [deletingCategoryId, setDeletingCategoryId] = useState('');
  const [deletingStrandId, setDeletingStrandId] = useState('');
  const [deletingTrackId, setDeletingTrackId] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingStrand, setCreatingStrand] = useState(false);
  const [creatingTrack, setCreatingTrack] = useState(false);

  const [cleanupDays, setCleanupDays] = useState(365);
  const [cleaning, setCleaning] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const metricCards = useMemo(
    () => [
      { label: 'Total Users', value: stats.totalUsers },
      { label: 'Total Research Submissions', value: stats.totalResearchSubmissions },
      { label: 'Pending Approvals', value: stats.pendingApprovals },
      { label: 'Approved Research', value: stats.approvedResearch }
    ],
    [stats]
  );

  const syncUserDrafts = useCallback((entries) => {
    setUserDrafts((current) => {
      const next = {};
      entries.forEach((entry) => {
        next[entry.id] = {
          role: current[entry.id]?.role ?? entry.role ?? 'student',
          fullName: current[entry.id]?.fullName ?? entry.full_name ?? '',
          track: current[entry.id]?.track ?? entry.track ?? ''
        };
      });
      return next;
    });
  }, []);

  const loadAdminData = useCallback(
    async () => {
      if (!hasSupabaseConfig || !user) {
        setLoading(false);
        return;
      }

      try {
        const [statsData, usersData, categoriesData, strandsData, tracksData] = await Promise.all([
          getAdminDashboardStatsUseCase(),
          listUsersUseCase(),
          listResearchCategoriesUseCase(),
          listStrandsUseCase(),
          listTracksUseCase()
        ]);

        setStats(statsData);
        setUsers(usersData);
        setCategories(categoriesData);
        setStrands(strandsData);
        setTracks(tracksData);
        syncUserDrafts(usersData);
      } catch (error) {
        toast.error(error.message || 'Unable to load admin dashboard.');
      } finally {
        setLoading(false);
      }
    },
    [hasSupabaseConfig, syncUserDrafts, toast, user]
  );

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleUserDraftChange = (userId, field, value) => {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        role: current[userId]?.role ?? 'student',
        fullName: current[userId]?.fullName ?? '',
        track: current[userId]?.track ?? '',
        [field]: value
      }
    }));
  };

  const handleSaveUser = async (userId) => {
    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }

    setSavingUserId(userId);

    try {
      await updateUserUseCase({
        userId,
        role: draft.role,
        fullName: draft.fullName,
        track: draft.track
      });
      toast.success('User account updated successfully.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to update user account.');
    } finally {
      setSavingUserId('');
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setCreatingCategory(true);

    try {
      await createResearchCategoryUseCase({ name: newCategoryName });
      setNewCategoryName('');
      toast.success('Research category created.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to create category.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    setDeletingCategoryId(id);

    try {
      await deleteResearchCategoryUseCase(id);
      toast.success('Research category deleted.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to delete category.');
    } finally {
      setDeletingCategoryId('');
    }
  };

  const handleCreateStrand = async (event) => {
    event.preventDefault();
    setCreatingStrand(true);

    try {
      await createStrandUseCase({ name: newStrandName });
      setNewStrandName('');
      toast.success('Strand created.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to create strand.');
    } finally {
      setCreatingStrand(false);
    }
  };

  const handleDeleteStrand = async (id) => {
    setDeletingStrandId(id);

    try {
      await deleteStrandUseCase(id);
      toast.success('Strand deleted.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to delete strand.');
    } finally {
      setDeletingStrandId('');
    }
  };

  const handleCreateTrack = async (event) => {
    event.preventDefault();
    setCreatingTrack(true);

    try {
      await createTrackUseCase({
        name: newTrackName,
        strandId: newTrackStrandId || null
      });
      setNewTrackName('');
      setNewTrackStrandId('');
      toast.success('Track created.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to create track.');
    } finally {
      setCreatingTrack(false);
    }
  };

  const handleDeleteTrack = async (id) => {
    setDeletingTrackId(id);

    try {
      await deleteTrackUseCase(id);
      toast.success('Track deleted.');
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to delete track.');
    } finally {
      setDeletingTrackId('');
    }
  };

  const handleCleanRecords = async () => {
    setCleaning(true);

    try {
      const result = await cleanRejectedResearchRecordsUseCase({ olderThanDays: cleanupDays });
      toast.success(
        `Cleanup completed. Deleted ${result.deletedCount} rejected record(s) older than ${cleanupDays} day(s).`
      );
      await loadAdminData();
    } catch (error) {
      toast.error(error.message || 'Unable to clean database records.');
    } finally {
      setCleaning(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);

    try {
      const payload = await exportBackupUseCase();
      const jsonText = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json' });
      const fileUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = fileUrl;
      anchor.download = `researchhub-backup-${toLocalFileTimestamp()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(fileUrl);
      toast.success('Backup export generated and downloaded.');
    } catch (error) {
      toast.error(error.message || 'Unable to generate backup export.');
    } finally {
      setBackingUp(false);
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
    <div className="space-y-6">
      {!isUserManagementRoute ? (
        <section className="rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white shadow-card">
          <p className="text-sm uppercase tracking-wide text-brand-100">Admin Dashboard</p>
          <h2 className="mt-2 text-2xl font-bold">Data Management and Monitoring</h2>
          <p className="mt-2 text-sm text-brand-100">
            Manage categories, strands, tracks, database cleanup, and backup operations.
          </p>
        </section>
      ) : null}

      {!isUserManagementRoute ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <article className="rounded-2xl bg-white p-5 shadow-card" key={card.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
            </article>
          ))}
        </section>
      ) : null}

      {isUserManagementRoute ? (
        <section className="rounded-2xl bg-white p-5 shadow-card" id="admin-user-management">
        <div className="mt-4 overflow-x-auto">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">No users found.</p>
          ) : (
            <table className="min-w-[860px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Email</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Track</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => {
                  const draft = userDrafts[entry.id] ?? {
                    role: entry.role ?? 'student',
                    fullName: entry.full_name ?? '',
                    track: entry.track ?? ''
                  };
                  const busy = savingUserId === entry.id;

                  return (
                    <tr className="border-b border-slate-100 align-top" key={entry.id}>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                          value={draft.fullName}
                          onChange={(event) =>
                            handleUserDraftChange(entry.id, 'fullName', event.target.value)
                          }
                          placeholder="Optional name"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-slate-700">{entry.email || 'No email'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                          value={draft.role}
                          onChange={(event) =>
                            handleUserDraftChange(entry.id, 'role', event.target.value)
                          }
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                          value={draft.track}
                          onChange={(event) =>
                            handleUserDraftChange(entry.id, 'track', event.target.value)
                          }
                        >
                          <option value="">Unassigned</option>
                          {tracks.map((track) => (
                            <option key={track.id} value={track.name}>
                              {track.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busy}
                          onClick={() => handleSaveUser(entry.id)}
                        >
                          {busy ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      ) : null}

      {!isUserManagementRoute ? (
        <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Research Categories</h3>
          <form className="mt-3 flex gap-2" onSubmit={handleCreateCategory}>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingCategory}
            >
              {creatingCategory ? 'Adding...' : 'Add'}
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {categories.map((entry) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2" key={entry.id}>
                <span className="text-sm text-slate-700">{entry.name}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deletingCategoryId === entry.id}
                  onClick={() => handleDeleteCategory(entry.id)}
                >
                  {deletingCategoryId === entry.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">No categories yet.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Strands</h3>
          <form className="mt-3 flex gap-2" onSubmit={handleCreateStrand}>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="New strand name"
              value={newStrandName}
              onChange={(event) => setNewStrandName(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingStrand}
            >
              {creatingStrand ? 'Adding...' : 'Add'}
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {strands.map((entry) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2" key={entry.id}>
                <span className="text-sm text-slate-700">{entry.name}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deletingStrandId === entry.id}
                  onClick={() => handleDeleteStrand(entry.id)}
                >
                  {deletingStrandId === entry.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
            {strands.length === 0 ? (
              <p className="text-sm text-slate-500">No strands yet.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">Tracks</h3>
          <form className="mt-3 space-y-2" onSubmit={handleCreateTrack}>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="New track name"
              value={newTrackName}
              onChange={(event) => setNewTrackName(event.target.value)}
            />
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              value={newTrackStrandId}
              onChange={(event) => setNewTrackStrandId(event.target.value)}
            >
              <option value="">No strand association</option>
              {strands.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creatingTrack}
            >
              {creatingTrack ? 'Adding...' : 'Add'}
            </button>
          </form>
          <div className="mt-3 space-y-2">
            {tracks.map((entry) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2" key={entry.id}>
                <div>
                  <p className="text-sm text-slate-700">{entry.name}</p>
                  <p className="text-xs text-slate-500">
                    Strand: {entry.strands?.name || 'Not linked'}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deletingTrackId === entry.id}
                  onClick={() => handleDeleteTrack(entry.id)}
                >
                  {deletingTrackId === entry.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
            {tracks.length === 0 ? (
              <p className="text-sm text-slate-500">No tracks yet.</p>
            ) : null}
          </div>
        </article>
      </section>
      ) : null}

      {!isUserManagementRoute ? (
        <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">System Cleanup</h3>
          <p className="mt-1 text-sm text-slate-600">
            Remove rejected research records older than the configured number of days.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Older than (days)</span>
              <input
                type="number"
                min="1"
                className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                value={cleanupDays}
                onChange={(event) => setCleanupDays(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={cleaning}
              onClick={handleCleanRecords}
            >
              {cleaning ? 'Cleaning...' : 'Run Cleanup'}
            </button>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-semibold text-slate-900">System Backup</h3>
          <p className="mt-1 text-sm text-slate-600">
            Export users, research, comments, notifications, and management tables to JSON.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={backingUp}
            onClick={handleBackup}
          >
            {backingUp ? 'Preparing backup...' : 'Download Backup'}
          </button>
        </article>
      </section>
      ) : null}
    </div>
  );
}
