import axios from 'axios';
import { clearAuthSession, getAccessToken } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5070',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    const requestUrl = config.url || '';
    const isAuthEndpoint = requestUrl.includes('/api/auth/');

    if (token && !isAuthEndpoint && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const originalRequestUrl = error.config?.url as string | undefined;
    const errorStatus = error.response?.status;
    const isLoginRequest = originalRequestUrl?.includes('/api/auth/login');

    if (errorStatus === 401 && !isLoginRequest) {
      clearAuthSession();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);

export default api;
