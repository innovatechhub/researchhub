import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES, getDashboardRouteByRole } from '../core/constants/routes';
import { useAuth } from './providers/AuthProvider';
import { AuthLayout } from '../presentation/layouts/AuthLayout';
import { StudentLayout } from '../presentation/layouts/StudentLayout';
import { RoleLayout } from '../presentation/layouts/RoleLayout';
import { LoginPage } from '../presentation/pages/LoginPage';
import { DashboardPage as StudentDashboardPage } from '../presentation/pages/student/DashboardPage';
import { SubmitResearchPage } from '../presentation/pages/student/SubmitResearchPage';
import { TeacherDashboardPage } from '../presentation/pages/teacher/DashboardPage';
import { TeacherApprovalPage } from '../presentation/pages/teacher/Approval';
import { AdminDashboardPage } from '../presentation/pages/admin/DashboardPage';
import { AdminResearchPage } from '../presentation/pages/admin/Research';
import { UserManagementPage } from '../presentation/pages/admin/UserManagement';
import { StrandPage } from '../presentation/pages/admin/Strand';
import { CategoryPage } from '../presentation/pages/admin/Category';
import { ResearcherDashboardPage } from '../presentation/pages/researcher/DashboardPage';
import { ResearcherOverviewPage } from '../presentation/pages/researcher/OverviewPage';
import { ProtectedRoute } from '../presentation/routes/ProtectedRoute';
import { LoadingSpinner } from '../presentation/components/common/LoadingSpinner';

export function AppRouter() {
  const { loading, user, role } = useAuth();
  const defaultDashboardRoute = getDashboardRouteByRole(role);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path={ROUTES.login}
        element={
          <AuthLayout>
            {user ? <Navigate to={defaultDashboardRoute} replace /> : <LoginPage />}
          </AuthLayout>
        }
      />

      <Route
        path={ROUTES.root}
        element={<Navigate to={user ? defaultDashboardRoute : ROUTES.login} replace />}
      />

      <Route element={<ProtectedRoute allowRoles={['student']} />}>
        <Route element={<StudentLayout />}>
          <Route path={ROUTES.studentDashboard} element={<StudentDashboardPage />} />
          <Route path={ROUTES.studentSubmit} element={<SubmitResearchPage />} />
          <Route path={ROUTES.studentLibrary} element={<ResearcherDashboardPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowRoles={['teacher']} />}>
        <Route
          element={
            <RoleLayout
              portalLabel="Teacher Portal"
              navItems={[
                { to: ROUTES.teacherDashboard, label: 'Dashboard' },
                { to: ROUTES.teacherApproval, label: 'Approval' },
                { to: ROUTES.teacherLibrary, label: 'Library' }
              ]}
            />
          }
        >
          <Route path={ROUTES.teacherDashboard} element={<TeacherDashboardPage />} />
          <Route path={ROUTES.teacherApproval} element={<TeacherApprovalPage />} />
          <Route path={ROUTES.teacherLibrary} element={<ResearcherDashboardPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowRoles={['admin']} />}>
        <Route
          element={
            <RoleLayout
              portalLabel="Admin Portal"
              navItems={[
                { to: ROUTES.adminDashboard, label: 'Admin Dashboard' },
                { to: ROUTES.adminResearch, label: 'Research' },
                {
                  to: ROUTES.adminUserManagement,
                  label: 'User Management',
                  children: [
                    { to: ROUTES.adminStrands, label: 'Strand' },
                    { to: ROUTES.adminCategories, label: 'Category' }
                  ]
                },
                { to: ROUTES.adminLibrary, label: 'Library' }
              ]}
            />
          }
        >
          <Route path={ROUTES.adminDashboard} element={<AdminDashboardPage />} />
          <Route path={ROUTES.adminResearch} element={<AdminResearchPage />} />
          <Route path={ROUTES.adminUserManagement} element={<UserManagementPage />} />
          <Route path={ROUTES.adminStrands} element={<StrandPage />} />
          <Route path={ROUTES.adminCategories} element={<CategoryPage />} />
          <Route path={ROUTES.adminLibrary} element={<ResearcherDashboardPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowRoles={['researcher']} />}>
        <Route
          element={
            <RoleLayout
              portalLabel="Researcher Portal"
              navItems={[
                { to: ROUTES.researcherDashboard, label: 'Dashboard' },
                { to: ROUTES.researcherLibrary, label: 'Library' }
              ]}
            />
          }
        >
          <Route path={ROUTES.researcherDashboard} element={<ResearcherOverviewPage />} />
          <Route path={ROUTES.researcherLibrary} element={<ResearcherDashboardPage />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? defaultDashboardRoute : ROUTES.login} replace />}
      />
    </Routes>
  );
}
