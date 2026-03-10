import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useToast } from '../../../app/providers/ToastProvider';
import {
  createUserUseCase,
  deleteUserUseCase,
  listStrandsUseCase,
  listTracksUseCase,
  listUsersUseCase,
  updateUserPasswordUseCase,
  updateUserUseCase
} from '../../../application/usecases/adminUseCases';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const EDIT_ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
  { value: 'researcher', label: 'Researcher' }
];

const CREATE_ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' }
];

const INITIAL_ADD_USER_FORM = {
  name: '',
  email: '',
  role: 'student',
  strand: '',
  password: '',
  confirmPassword: ''
};

const INITIAL_UPDATE_USER_FORM = {
  userId: '',
  name: '',
  email: '',
  role: 'student',
  strand: ''
};
const INITIAL_PASSWORD_FORM = {
  userId: '',
  email: '',
  newPassword: '',
  confirmPassword: ''
};
const PAGE_SIZE = 10;

function EyeIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.9 17.9C16.2 19 14.2 19.6 12 19.6c-6.4 0-10-6-10-6 1-1.7 2.3-3.2 3.9-4.4" />
      <path d="M9.9 4.4A12 12 0 0 1 12 4.2c6.4 0 10 6 10 6a19 19 0 0 1-2.4 3.2" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function formatRoleLabel(role) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ') : 'Unknown';
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'admin':
      return 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200';
    case 'teacher':
      return 'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200';
    case 'researcher':
      return 'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200';
    default:
      return 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200';
  }
}

function getUserInitials(fullName, email) {
  const source = (fullName || email || '').trim();
  if (!source) {
    return 'U';
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function UserManagementPage() {
  const { hasSupabaseConfig, user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [strands, setStrands] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [deletingUserId, setDeletingUserId] = useState('');
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState(INITIAL_ADD_USER_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [updateUserForm, setUpdateUserForm] = useState(INITIAL_UPDATE_USER_FORM);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [showNewPasswordValue, setShowNewPasswordValue] = useState(false);
  const [showConfirmNewPasswordValue, setShowConfirmNewPasswordValue] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(users.length / PAGE_SIZE)), [users.length]);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return users.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, users]);
  const emptyRowCount = useMemo(() => {
    if (paginatedUsers.length === 0) {
      return PAGE_SIZE - 1;
    }

    return PAGE_SIZE - paginatedUsers.length;
  }, [paginatedUsers.length]);
  const visibleStart = users.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const visibleEnd = users.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, users.length);

  const loadData = useCallback(async () => {
    if (!hasSupabaseConfig || !user) {
      setLoading(false);
      return;
    }

    try {
      const [usersData, tracksData, strandsData] = await Promise.all([
        listUsersUseCase(),
        listTracksUseCase(),
        listStrandsUseCase()
      ]);
      setUsers(usersData);
      setTracks(tracksData);
      setStrands(strandsData);
    } catch (error) {
      toast.error(error.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [hasSupabaseConfig, toast, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleDeleteUser = async (userId, email) => {
    const confirmed = window.confirm(`Delete user account${email ? ` (${email})` : ''}?`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);
    try {
      await deleteUserUseCase(userId);
      toast.success('User account deleted successfully.');
      setOpenActionMenuUserId('');
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to delete user account.');
    } finally {
      setDeletingUserId('');
    }
  };

  const handleOpenAddModal = () => {
    setAddUserForm(INITIAL_ADD_USER_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    if (creatingUser) {
      return;
    }

    setIsAddModalOpen(false);
  };

  const handleAddUserFieldChange = (field, value) => {
    setAddUserForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleAddUserSubmit = async (event) => {
    event.preventDefault();

    if (addUserForm.password !== addUserForm.confirmPassword) {
      toast.error('Password and confirm password do not match.');
      return;
    }

    if (addUserForm.role === 'student' && strands.length === 0) {
      toast.error('No strands available. Please create a strand first.');
      return;
    }

    setCreatingUser(true);
    try {
      await createUserUseCase({
        fullName: addUserForm.name,
        email: addUserForm.email,
        role: addUserForm.role,
        password: addUserForm.password,
        strand: addUserForm.role === 'student' ? addUserForm.strand : null
      });
      toast.success('User account created successfully.');
      setAddUserForm(INITIAL_ADD_USER_FORM);
      setIsAddModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to create user account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleOpenUpdateModal = (entry) => {
    setUpdateUserForm({
      userId: entry.id,
      name: entry.full_name ?? '',
      email: entry.email ?? '',
      role: entry.role ?? 'student',
      strand: entry.track ?? ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    if (updatingUser) {
      return;
    }

    setIsUpdateModalOpen(false);
    setUpdateUserForm(INITIAL_UPDATE_USER_FORM);
  };

  const handleUpdateUserFieldChange = (field, value) => {
    setUpdateUserForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleUpdateUserSubmit = async (event) => {
    event.preventDefault();

    if (!updateUserForm.userId) {
      toast.error('Invalid user selected.');
      return;
    }

    if (updateUserForm.role === 'student' && !updateUserForm.strand) {
      toast.error('Strand is required for student.');
      return;
    }

    setUpdatingUser(true);
    try {
      await updateUserUseCase({
        userId: updateUserForm.userId,
        role: updateUserForm.role,
        fullName: updateUserForm.name,
        track: updateUserForm.role === 'student' ? updateUserForm.strand : null
      });
      toast.success('User account updated successfully.');
      setIsUpdateModalOpen(false);
      setUpdateUserForm(INITIAL_UPDATE_USER_FORM);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'Unable to update user account.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleOpenPasswordModal = (entry) => {
    setPasswordForm({
      userId: entry.id,
      email: entry.email ?? '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowNewPasswordValue(false);
    setShowConfirmNewPasswordValue(false);
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    if (updatingPassword) {
      return;
    }

    setIsPasswordModalOpen(false);
    setPasswordForm(INITIAL_PASSWORD_FORM);
  };

  const handlePasswordFieldChange = (field, value) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleUpdatePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!passwordForm.userId) {
      toast.error('Invalid user selected.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Password and confirm password do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateUserPasswordUseCase({
        userId: passwordForm.userId,
        newPassword: passwordForm.newPassword
      });
      toast.success('User password updated successfully.');
      setIsPasswordModalOpen(false);
      setPasswordForm(INITIAL_PASSWORD_FORM);
    } catch (error) {
      toast.error(error.message || 'Unable to update user password.');
    } finally {
      setUpdatingPassword(false);
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
    <section className="rounded-2xl bg-white p-5 shadow-card" id="admin-user-management">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          onClick={handleOpenAddModal}
        >
          Add User
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">User Accounts</p>
          <p className="text-xs text-slate-500">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Track</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((entry) => {
                const isDeleting = deletingUserId === entry.id;

                return (
                  <tr
                    className="border-b border-slate-100 transition-colors even:bg-slate-50/40 hover:bg-brand-50/50"
                    key={entry.id}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                          {getUserInitials(entry.full_name, entry.email)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{entry.full_name || 'No name'}</p>
                          <p className="text-xs text-slate-500">{entry.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.email || 'No email'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeClass(entry.role)}`}>
                        {formatRoleLabel(entry.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{entry.track || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isDeleting}
                          onClick={() =>
                            setOpenActionMenuUserId((current) => (current === entry.id ? '' : entry.id))
                          }
                          aria-label="Open actions menu"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {openActionMenuUserId === entry.id ? (
                          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setOpenActionMenuUserId('');
                                handleOpenUpdateModal(entry);
                              }}
                            >
                              Update User
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setOpenActionMenuUserId('');
                                handleOpenPasswordModal(entry);
                              }}
                            >
                              Update Password
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isDeleting}
                              onClick={async () => {
                                await handleDeleteUser(entry.id, entry.email);
                              }}
                            >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedUsers.length === 0 ? (
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-500" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : null}

              {Array.from({ length: emptyRowCount }).map((_, index) => (
                <tr className="border-b border-slate-100" key={`empty-row-${index}`}>
                  <td className="px-4 py-3" colSpan={5}>
                    &nbsp;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {visibleStart}-{visibleEnd} of {users.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === 1}
                onClick={() => {
                  setOpenActionMenuUserId('');
                  setCurrentPage((page) => Math.max(1, page - 1));
                }}
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPage === totalPages}
                onClick={() => {
                  setOpenActionMenuUserId('');
                  setCurrentPage((page) => Math.min(totalPages, page + 1));
                }}
              >
                Next
              </button>
            </div>
          </div>
      </div>
      </div>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add User</h3>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                onClick={handleCloseAddModal}
                disabled={creatingUser}
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleAddUserSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={addUserForm.name}
                  onChange={(event) => handleAddUserFieldChange('name', event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={addUserForm.email}
                  onChange={(event) => handleAddUserFieldChange('email', event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Role</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={addUserForm.role}
                  onChange={(event) => handleAddUserFieldChange('role', event.target.value)}
                >
                  {CREATE_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {addUserForm.role === 'student' ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Strand</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={addUserForm.strand}
                    onChange={(event) => handleAddUserFieldChange('strand', event.target.value)}
                    required
                  >
                    <option value="">Select strand</option>
                    {strands.map((entry) => (
                      <option key={entry.id} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={addUserForm.password}
                    onChange={(event) => handleAddUserFieldChange('password', event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Confirm Password</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={addUserForm.confirmPassword}
                    onChange={(event) => handleAddUserFieldChange('confirmPassword', event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleCloseAddModal}
                  disabled={creatingUser}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creatingUser}
                >
                  {creatingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isPasswordModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Update Password</h3>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                onClick={handleClosePasswordModal}
                disabled={updatingPassword}
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleUpdatePasswordSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value={passwordForm.email}
                  readOnly
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">New Password</span>
                <div className="relative">
                  <input
                    type={showNewPasswordValue ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={passwordForm.newPassword}
                    onChange={(event) => handlePasswordFieldChange('newPassword', event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowNewPasswordValue((current) => !current)}
                    aria-label={showNewPasswordValue ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPasswordValue ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Confirm Password</span>
                <div className="relative">
                  <input
                    type={showConfirmNewPasswordValue ? 'text' : 'password'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => handlePasswordFieldChange('confirmPassword', event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    onClick={() => setShowConfirmNewPasswordValue((current) => !current)}
                    aria-label={
                      showConfirmNewPasswordValue ? 'Hide confirm password' : 'Show confirm password'
                    }
                  >
                    {showConfirmNewPasswordValue ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleClosePasswordModal}
                  disabled={updatingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingPassword}
                >
                  {updatingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUpdateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Update User</h3>
              <button
                type="button"
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                onClick={handleCloseUpdateModal}
                disabled={updatingUser}
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleUpdateUserSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={updateUserForm.name}
                  onChange={(event) => handleUpdateUserFieldChange('name', event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value={updateUserForm.email}
                  readOnly
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Role</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  value={updateUserForm.role}
                  onChange={(event) => handleUpdateUserFieldChange('role', event.target.value)}
                >
                  {EDIT_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {updateUserForm.role === 'student' ? (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Strand</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    value={updateUserForm.strand}
                    onChange={(event) => handleUpdateUserFieldChange('strand', event.target.value)}
                    required
                  >
                    <option value="">Select strand</option>
                    {strands.map((entry) => (
                      <option key={entry.id} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                    {tracks.map((entry) => (
                      <option key={entry.id} value={entry.name}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleCloseUpdateModal}
                  disabled={updatingUser}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingUser}
                >
                  {updatingUser ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
