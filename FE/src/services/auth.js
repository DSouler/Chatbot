import instance from "./instance"

const baseUrl = '/auth-service'

export const getCurrentUser = async () => {
    return instance.get(`${baseUrl}/me`);
};

export const login = async (username, password) => {
    return instance.post(`${baseUrl}/login`, { username, password });
};


const authService = {
    getCurrentUser,
    login
};

export default authService;