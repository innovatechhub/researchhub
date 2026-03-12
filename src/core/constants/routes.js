import { USER_ROLES, normalizeRole } from './roles';

export const ROUTES = {
  root: '/',
  login: '/login',
  studentDashboard: '/student/dashboard',
  studentSubmit: '/student/submit',
  studentLibrary: '/student/library',
  teacherDashboard: '/teacher/dashboard',
  teacherApproval: '/teacher/approval',
  teacherLibrary: '/teacher/library',
  adminDashboard: '/admin/dashboard',
  adminResearch: '/admin/research',
  adminUserManagement: '/admin/users',
  adminStrands: '/admin/strands',
  adminCategories: '/admin/categories',
  adminLibrary: '/admin/library',
  researcherDashboard: '/researcher/dashboard'
};

export function getDashboardRouteByRole(role) {
  switch (normalizeRole(role)) {
    case USER_ROLES.teacher:
      return ROUTES.teacherDashboard;
    case USER_ROLES.admin:
      return ROUTES.adminDashboard;
    case USER_ROLES.researcher:
      return ROUTES.researcherDashboard;
    case USER_ROLES.student:
    default:
      return ROUTES.studentDashboard;
  }
}
