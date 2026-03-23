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

const authService = {
    getCurrentUser,
    login,
    register
};

export default authService;