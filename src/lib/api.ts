import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  setAuthSession,
} from './auth';

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
type RefreshOptions = {
  redirectOnFail?: boolean;
};

const LOGIN_PATH = '/login';

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

const redirectToLogin = () => {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
};

const handleRefreshFailure = (redirectOnFail: boolean) => {
  clearAuthSession();

  if (redirectOnFail) {
    redirectToLogin();
  }
};

const persistAuthTokens = (authData: RefreshTokenResponse['data']) => {
  const nextAccessToken = authData?.accessToken || authData?.token;

  if (!nextAccessToken) {
    return null;
  }

  setAuthSession({
    accessToken: nextAccessToken,
    refreshToken: authData?.refreshToken || getRefreshToken(),
    fullName: authData?.fullName || localStorage.getItem('fullName'),
  });

  return nextAccessToken;
};

let refreshAccessTokenPromise: Promise<string | null> | null = null;

const requestFreshAccessToken = async (redirectOnFail: boolean) => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    handleRefreshFailure(redirectOnFail);
    return null;
  }

  try {
    const refreshResponse = await refreshClient.post<RefreshTokenResponse>(
      '/api/auth/refresh-token',
      { refreshToken },
    );

    if (refreshResponse.data.success === false) {
      throw new Error('Refresh token request failed.');
    }

    const nextAccessToken = persistAuthTokens(refreshResponse.data.data);

    if (!nextAccessToken) {
      throw new Error('Refresh response did not include an access token.');
    }

    return nextAccessToken;
  } catch {
    handleRefreshFailure(redirectOnFail);
    return null;
  }
};

export const refreshAccessToken = async (
  options: RefreshOptions = {},
) => {
  const redirectOnFail = options.redirectOnFail ?? true;

  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = requestFreshAccessToken(redirectOnFail).finally(() => {
      refreshAccessTokenPromise = null;
    });
  }

  return refreshAccessTokenPromise;
};

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
      originalRequest._retry = true;

      const nextAccessToken = await refreshAccessToken();

      if (nextAccessToken) {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        }

        return api(originalRequest);
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default api;
