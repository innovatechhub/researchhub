import { PortalLayout } from './PortalLayout';
import { ROUTES } from '../../core/constants/routes';

export function StudentLayout() {
  const navItems = [
    { to: ROUTES.studentDashboard, label: 'Dashboard' },
    { to: ROUTES.studentSubmit, label: 'Research' },
    { to: '/student/progress', label: 'My Progress' },
    { to: ROUTES.studentLibrary, label: 'Library' }
  ];

  return <PortalLayout portalLabel="Student Portal" navItems={navItems} />;
}
