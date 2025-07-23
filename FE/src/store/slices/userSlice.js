import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/auth';
import Cookies from 'js-cookie';

// Helper function to get initial state from cookies
const getInitialState = () => {
  const token = Cookies.get('token');
  const userCookie = Cookies.get('user');
  
  if (token && userCookie) {
    try {
      const user = JSON.parse(userCookie);
      return {
        user,
        isAuthenticated: true,
        loading: false,
        error: null,
      };
    } catch (error) {
      console.error('Error parsing user cookie:', error);
    }
  }
  
  return {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  };
};

// Async thunk for login
export const loginUser = createAsyncThunk(
  'user/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(username, password);
      const access_token = response.access_token;
      Cookies.set('token', access_token, { sameSite: 'strict' });

      const userData = await authService.getCurrentUser();
      Cookies.set('user', JSON.stringify(userData), { sameSite: 'strict' });
      
      return userData;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Login failed');
    }
  }
);

// Async thunk for getting current user
export const getCurrentUser = createAsyncThunk(
  'user/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const userData = await authService.getCurrentUser();
      return userData;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to get user data');
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'user/logout',
  async () => {
    Cookies.remove('token');
    Cookies.remove('user');
    return null;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState: getInitialState(),
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.user = null;
        state.isAuthenticated = false;
      })
      // Get current user cases
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // Logout cases
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      });
  },
});

export const { clearError, setUser } = userSlice.actions;
export default userSlice.reducer; 