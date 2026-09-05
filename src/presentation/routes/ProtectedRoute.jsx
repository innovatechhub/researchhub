import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES, getDashboardRouteByRole } from '../../core/constants/routes';
import { useAuth } from '../../app/providers/AuthProvider';

export function ProtectedRoute({ allowRoles = [] }) {
  const { user, role, loading, profileLoading } = useAuth();
  const location = useLocation();
  if (loading || profileLoading)
    return (
      <div role="status" className="empty-panel">
        Loading your account…
      </div>
    );
  if (user && !role)
    return (
      <div role="alert" className="empty-panel">
        Your account role could not be verified. Please reload or contact the school administrator.
      </div>
    );

  if (!user) {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }

  if (allowRoles.length > 0 && !allowRoles.includes(role)) {
    return <Navigate to={getDashboardRouteByRole(role)} replace />;
  }

  return <Outlet />;
}
