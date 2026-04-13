import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { loginUser, getCurrentUser, logoutUser, clearError } from '../store/slices/userSlice';

export const useUser = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading, error } = useSelector((state) => state.user);

  const login = useCallback((username, password) => {
    return dispatch(loginUser({ username, password }));
  }, [dispatch]);

  const logout = useCallback(() => {
    return dispatch(logoutUser());
  }, [dispatch]);

  const fetchCurrentUser = useCallback(() => {
    return dispatch(getCurrentUser());
  }, [dispatch]);

  const clearUserError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    fetchCurrentUser,
    clearUserError,
  };
};