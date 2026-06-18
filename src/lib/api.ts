import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken } from './auth';

type RefreshTokenResponse = {
  success?: boolean;
  data?: {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    fullName?: string;
  } | null;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://localhost:7122',
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://localhost:7122',
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
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const originalRequestUrl = originalRequest?.url as string | undefined;
    const errorStatus = error.response?.status;
    const isLoginRequest = originalRequestUrl?.includes('/api/auth/login');
    const isRefreshRequest = originalRequestUrl?.includes('/api/auth/refresh-token');

    if (errorStatus === 401 && originalRequest && !originalRequest._retry && !isLoginRequest && !isRefreshRequest) {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        try {
          originalRequest._retry = true;

          const refreshResponse = await refreshClient.post<RefreshTokenResponse>(
            '/api/auth/refresh-token',
            { refreshToken },
          );
          const authData = refreshResponse.data.data;
          const nextAccessToken = authData?.accessToken || authData?.token;

          if (nextAccessToken) {
            localStorage.setItem('accessToken', nextAccessToken);

            if (authData?.refreshToken) {
              localStorage.setItem('refreshToken', authData.refreshToken);
            }

            if (authData?.fullName) {
              localStorage.setItem('fullName', authData.fullName);
            }

            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

            return api(originalRequest);
          }
        } catch {
          // Fall through to clear the session below.
        }
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
