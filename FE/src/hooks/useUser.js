import { useSelector, useDispatch } from 'react-redux';
import { loginUser, getCurrentUser, logoutUser, clearError } from '../store/slices/userSlice';

export const useUser = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading, error } = useSelector((state) => state.user);

  const login = (username, password) => {
    return dispatch(loginUser({ username, password }));
  };

  const logout = () => {
    return dispatch(logoutUser());
  };

  const fetchCurrentUser = () => {
    return dispatch(getCurrentUser());
  };

  const clearUserError = () => {
    dispatch(clearError());
  };

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