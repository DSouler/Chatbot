import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

export default function ProtectedRoute({ children }) {
  // Skip authentication in development mode
  if (import.meta.env.VITE_APP_SKIP_AUTH === 'true') {
    return children;
  }

  // Allow guest mode (set by Landing page)
  if (sessionStorage.getItem('guestMode') === 'true') {
    return children;
  }

  const { user, isAuthenticated } = useUser();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
}
