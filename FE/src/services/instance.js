import axios from "axios";
import Cookies from 'js-cookie';
import { store } from '../store';
import { logoutUser } from '../store/slices/userSlice';
// import { redirect } from "react-router-dom";

const instance = axios.create({
    baseURL: import.meta.env.VITE_APP_BACKEND_BASE_URL,
})

instance.interceptors.request.use((config) => {
    const token = Cookies.get('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

instance.interceptors.response.use((response) => {

    if (response && response.data !== undefined) {
        // only get data
        return response.data;
    }

    return response;
}, async (error) => {
    // Handle 401 Unauthorized error
    if (error.response && error.response.status === 401) {
        // Only redirect to login if not already on login page
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
            // Dispatch logout action to clear Redux state
            store.dispatch(logoutUser());
            
            // Redirect to login page
            window.location.href = '/login';
        }
    }
    
    throw error
});

export default instance