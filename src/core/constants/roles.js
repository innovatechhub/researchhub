export const USER_ROLES = {
  student: 'student',
  teacher: 'teacher',
  admin: 'admin',
  researcher: 'researcher'
};

const ROLE_ALIASES = {
  reviewer: USER_ROLES.teacher,
  public_researcher: USER_ROLES.researcher
};

export function normalizeRole(rawRole) {
  if (!rawRole) {
    return USER_ROLES.student;
  }

  const key = String(rawRole).trim().toLowerCase();
  const role = ROLE_ALIASES[key] ?? key;

  if (Object.values(USER_ROLES).includes(role)) {
    return role;
  }

  return USER_ROLES.student;
}
