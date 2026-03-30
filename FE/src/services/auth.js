import axios from 'axios';
import Cookies from 'js-cookie';

const AUTH_BASE_URL = import.meta.env.VITE_APP_AUTH_BASE_URL || 'http://localhost:8093';

const authInstance = axios.create({
    baseURL: AUTH_BASE_URL,
});

authInstance.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

authInstance.interceptors.response.use((response) => {
    if (response && response.data !== undefined) {
        return response.data;
    }
    return response;
});

export const getCurrentUser = async () => {
    return authInstance.get('/me');
};

export const login = async (username, password) => {
    return authInstance.post('/login', { username, password });
};

export const register = async (username, password, email) => {
    return authInstance.post('/register', { username, password, email });
};

export const updateProfile = async (first_name, last_name) => {
    return authInstance.put('/me/profile', { first_name, last_name });
};

export const updatePassword = async (current_password, new_password) => {
    return authInstance.put('/me/password', { current_password, new_password });
};

// ── Admin API ──

export const adminGetUsers = async () => {
    return authInstance.get('/admin/users');
};

export const adminCreateUser = async (data) => {
    return authInstance.post('/admin/users', data);
};

export const adminUpdateUser = async (userId, data) => {
    return authInstance.put(`/admin/users/${userId}`, data);
};

export const adminDeleteUser = async (userId) => {
    return authInstance.delete(`/admin/users/${userId}`);
};

const authService = {
    getCurrentUser,
    login,
    register,
    updateProfile,
    updatePassword,
    adminGetUsers,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
};

export default authService;