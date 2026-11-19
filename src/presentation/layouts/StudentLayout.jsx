import { PortalLayout } from './PortalLayout';
import { ROUTES } from '../../core/constants/routes';

export function StudentLayout() {
  const navItems = [
    { to: ROUTES.studentDashboard, label: 'Dashboard' },
    { to: '/student/progress', label: 'My Research' },
    { to: '/student/notifications', label: 'Notifications' },
    { to: '/student/profile', label: 'Profile' },
    { to: '/student/help', label: 'Help & Support' }
  ];

  return <PortalLayout portalLabel="Student Portal" navItems={navItems} />;
}
