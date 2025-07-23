import { useEffect, useState } from 'react';
import { useUser } from '../hooks/useUser';
import Cookies from 'js-cookie';
import LoadingScreen from './LoadingScreen';

const AuthInitializer = ({ children }) => {
  const { fetchCurrentUser, isAuthenticated, loading, user } = useUser();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = Cookies.get('token');
      // Only fetch user data if we have a token but no user in Redux state
      if (token && !user) {
        try {
          await fetchCurrentUser();
        } catch (error) {
          console.log('Failed to initialize auth:', error);
        }
      }
      setIsInitialized(true);
    };

    initializeAuth();
  }, [fetchCurrentUser, user]);

  // Show loading state only if we're actually loading and not authenticated
  if (!isInitialized || (loading && !isAuthenticated && !user)) {
    return <LoadingScreen />;
  }

  return children;
};

export default AuthInitializer; 