import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ResearchAnalyticsPanel } from '../../components/analytics/ResearchAnalyticsPanel';
import {
  getAdminDashboardStatsUseCase,
  listTracksUseCase,
  listUsersUseCase,
  updateUserUseCase
} from '../../../application/usecases/adminUseCases';
import { listAllResearchesUseCase } from '../../../application/usecases/researchUseCases';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '../../../core/constants/routes';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'researcher', label: 'Researcher' }
];

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
  const [allResearches, setAllResearches] = useState([]);
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState('');

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
        const [statsData, allResearchesData, usersData, tracksData] = await Promise.all([
          getAdminDashboardStatsUseCase(),
          listAllResearchesUseCase(),
          listUsersUseCase(),
          listTracksUseCase()
        ]);

        setStats(statsData);
        setAllResearches(allResearchesData);
        setUsers(usersData);
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
            Monitor platform metrics and research activity across the system.
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

      {!isUserManagementRoute ? (
        <ResearchAnalyticsPanel
          records={allResearches}
          title="Platform Submission Analytics"
          subtitle="Monitor which year and strand have the highest upload activity."
          focusLabel="uploads"
        />
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
    </div>
  );
}
