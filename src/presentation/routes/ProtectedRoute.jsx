import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES, getDashboardRouteByRole } from '../../core/constants/routes';
import { useAuth } from '../../app/providers/AuthProvider';

export function ProtectedRoute({ allowRoles = [] }) {
  const { user, role } = useAuth();

  if (!user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (allowRoles.length > 0 && !allowRoles.includes(role)) {
    return <Navigate to={getDashboardRouteByRole(role)} replace />;
  }

  return <Outlet />;
}
