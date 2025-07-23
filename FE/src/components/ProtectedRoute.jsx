import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

export default function ProtectedRoute({ children }) {
  const { user, isAuthenticated } = useUser();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    // Redirect to login page but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
} 