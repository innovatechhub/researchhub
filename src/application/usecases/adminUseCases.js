import {
  cleanRejectedResearchRecordsRepository,
  createUserRepository,
  createResearchCategoryRepository,
  createStrandRepository,
  createTrackRepository,
  deleteUserRepository,
  deleteResearchCategoryRepository,
  deleteStrandRepository,
  deleteTrackRepository,
  exportBackupRepository,
  getAdminDashboardStatsRepository,
  listResearchCategoriesRepository,
  listStrandsRepository,
  listTracksRepository,
  listUsersRepository,
  updateUserPasswordRepository,
  updateUserRepository
} from '../../infrastructure/repositories/adminRepository';
import { normalizeRole } from '../../core/constants/roles';

const MANAGEABLE_ROLES = ['student', 'teacher', 'admin', 'researcher'];
const CREATABLE_ROLES = ['student', 'teacher', 'admin'];

function requireName(name, entityLabel) {
  const normalized = name?.trim() ?? '';
  if (!normalized) {
    throw new Error(`${entityLabel} name is required.`);
  }

  return normalized;
}

export async function getAdminDashboardStatsUseCase() {
  return getAdminDashboardStatsRepository();
}

export async function listUsersUseCase() {
  return listUsersRepository();
}

export async function createUserUseCase({ fullName, email, role, password, strand }) {
  const normalizedName = fullName?.trim() ?? '';
  if (!normalizedName) {
    throw new Error('Name is required.');
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? '';
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.');
  }

  const normalizedRole = normalizeRole(role);
  if (!CREATABLE_ROLES.includes(normalizedRole)) {
    throw new Error('Invalid role for new user.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (normalizedRole === 'student' && !(strand?.trim() ?? '')) {
    throw new Error('Strand is required for student.');
  }

  return createUserRepository({
    fullName: normalizedName,
    email: normalizedEmail,
    role: normalizedRole,
    password,
    strand: normalizedRole === 'student' ? strand : null
  });
}

export async function deleteUserUseCase(userId) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  return deleteUserRepository(userId);
}

export async function updateUserPasswordUseCase({ userId, newPassword }) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  return updateUserPasswordRepository({
    userId,
    newPassword
  });
}

export async function updateUserUseCase({ userId, role, fullName, track }) {
  if (!userId) {
    throw new Error('User id is required.');
  }

  const normalizedRole = normalizeRole(role);

  if (!MANAGEABLE_ROLES.includes(normalizedRole)) {
    throw new Error('Invalid user role.');
  }

  return updateUserRepository({
    userId,
    role: normalizedRole,
    fullName,
    track
  });
}

export async function listResearchCategoriesUseCase() {
  return listResearchCategoriesRepository();
}

export async function createResearchCategoryUseCase({ name }) {
  const normalizedName = requireName(name, 'Category');
  return createResearchCategoryRepository({ name: normalizedName });
}

export async function deleteResearchCategoryUseCase(id) {
  if (!id) {
    throw new Error('Category id is required.');
  }

  return deleteResearchCategoryRepository(id);
}

export async function listStrandsUseCase() {
  return listStrandsRepository();
}

export async function createStrandUseCase({ name }) {
  const normalizedName = requireName(name, 'Strand');
  return createStrandRepository({ name: normalizedName });
}

export async function deleteStrandUseCase(id) {
  if (!id) {
    throw new Error('Strand id is required.');
  }

  return deleteStrandRepository(id);
}

export async function listTracksUseCase() {
  return listTracksRepository();
}

export async function createTrackUseCase({ name, strandId }) {
  const normalizedName = requireName(name, 'Track');
  return createTrackRepository({ name: normalizedName, strandId });
}

export async function deleteTrackUseCase(id) {
  if (!id) {
    throw new Error('Track id is required.');
  }

  return deleteTrackRepository(id);
}

export async function cleanRejectedResearchRecordsUseCase({ olderThanDays }) {
  const days = Number(olderThanDays);

  if (!Number.isInteger(days) || days < 1) {
    throw new Error('Cleanup days must be a positive integer.');
  }

  return cleanRejectedResearchRecordsRepository({ olderThanDays: days });
}

export async function exportBackupUseCase() {
  return exportBackupRepository();
}
