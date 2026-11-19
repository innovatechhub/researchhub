import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../core/constants/routes';
import { AuthLayout } from '../presentation/layouts/AuthLayout';
import { StudentLayout } from '../presentation/layouts/StudentLayout';
import { RoleLayout } from '../presentation/layouts/RoleLayout';
import { LoginPage } from '../presentation/pages/LoginPage';
import { ProtectedRoute } from '../presentation/routes/ProtectedRoute';
import { PublicLayout } from '../presentation/layouts/PublicLayout';
import { HomePage, BrowsePage, InformationPage } from '../presentation/pages/public/PublicPages';
const page = (load, name) => lazy(() => load().then((module) => ({ default: module[name] })));
const StudentHomePage = page(
  () => import('../presentation/pages/student/StudentHomePage'),
  'StudentHomePage'
);
const ReviewQueuePage = page(
  () => import('../presentation/pages/teacher/ReviewQueuePage'),
  'ReviewQueuePage'
);
const NotificationsPage = page(
  () => import('../presentation/pages/common/AccountPages'),
  'NotificationsPage'
);
const ProfilePage = page(() => import('../presentation/pages/common/AccountPages'), 'ProfilePage');
const HelpPage = page(() => import('../presentation/pages/common/AccountPages'), 'HelpPage');
const AdminDashboardPage = page(
  () => import('../presentation/pages/admin/DashboardPage'),
  'AdminDashboardPage'
);
const AdminResearchPage = page(
  () => import('../presentation/pages/admin/Research'),
  'AdminResearchPage'
);
const UserManagementPage = page(
  () => import('../presentation/pages/admin/UserManagement'),
  'UserManagementPage'
);
const StrandPage = page(() => import('../presentation/pages/admin/Strand'), 'StrandPage');
const CategoryPage = page(() => import('../presentation/pages/admin/Category'), 'CategoryPage');
const ReportsPage = page(() => import('../presentation/pages/admin/Reports'), 'ReportsPage');
const ResearcherDashboardPage = page(
  () => import('../presentation/pages/researcher/DashboardPage'),
  'ResearcherDashboardPage'
);
const ResearcherOverviewPage = page(
  () => import('../presentation/pages/researcher/OverviewPage'),
  'ResearcherOverviewPage'
);
const ResearchWorkspace = page(
  () => import('../presentation/pages/workflow/ResearchWorkspace'),
  'ResearchWorkspace'
);
const NewResearchPage = page(
  () => import('../presentation/pages/workflow/NewResearchPage'),
  'NewResearchPage'
);
const ProgressPage = page(
  () => import('../presentation/pages/workflow/ProgressPage'),
  'ProgressPage'
);
const AssignmentsPage = page(
  () => import('../presentation/pages/workflow/AssignmentsPage'),
  'AssignmentsPage'
);
const PublicationsPage = page(
  () => import('../presentation/pages/workflow/PublicationsPage'),
  'PublicationsPage'
);

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="empty-panel" role="status">
          Loading page…
        </div>
      }
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/about" element={<InformationPage type="about" />} />
          <Route path="/guidelines" element={<InformationPage type="guidelines" />} />
          <Route path="/contact" element={<InformationPage type="contact" />} />
        </Route>
        <Route
          path={ROUTES.login}
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />

        <Route element={<ProtectedRoute allowRoles={['student']} />}>
          <Route element={<StudentLayout />}>
            <Route path={ROUTES.studentDashboard} element={<StudentHomePage />} />
            <Route path="/student/notifications" element={<NotificationsPage />} />
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route path="/student/help" element={<HelpPage />} />
            <Route path={ROUTES.studentSubmit} element={<NewResearchPage />} />
            <Route path="/student/progress" element={<ProgressPage />} />
            <Route path="/student/research/:id" element={<ResearchWorkspace />} />
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
                  { to: ROUTES.teacherApproval, label: 'Review Queue' },
                  { to: '/teacher/deadlines', label: 'Manage Research' },
                  { to: '/teacher/students', label: 'Students' },
                  { to: '/teacher/progress', label: 'Reports' },
                  { to: '/teacher/settings', label: 'Settings' },
                  { to: '/teacher/help', label: 'Help & Support' }
                ]}
              />
            }
          >
            <Route path={ROUTES.teacherDashboard} element={<ReviewQueuePage />} />
            <Route
              path={ROUTES.teacherApproval}
              element={<ReviewQueuePage initialFilter="submitted" />}
            />
            <Route path="/teacher/settings" element={<ProfilePage />} />
            <Route path="/teacher/help" element={<HelpPage />} />
            <Route path="/teacher/students" element={<AssignmentsPage />} />
            <Route path="/teacher/progress" element={<ProgressPage />} />
            <Route path="/teacher/deadlines" element={<ProgressPage deadlinesOnly />} />
            <Route path="/teacher/research/:id" element={<ResearchWorkspace />} />
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
                  { to: '/admin/assignments', label: 'Teacher Assignments' },
                  { to: '/admin/progress', label: 'Progress Reports' },
                  { to: '/admin/reports', label: 'Reports' },
                  { to: '/admin/publications', label: 'Public Previews' },
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
            <Route path="/admin/assignments" element={<AssignmentsPage />} />
            <Route path="/admin/progress" element={<ProgressPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/publications" element={<PublicationsPage />} />
            <Route path="/admin/research/:id" element={<ResearchWorkspace />} />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
