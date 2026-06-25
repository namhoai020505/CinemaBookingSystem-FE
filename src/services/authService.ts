import api from '../lib/api';
import { clearAuthSession, getRefreshToken, isAdminRole } from '../lib/auth';

type AdminProfileResponse = {
  role?: string;
};

type ApiResponse<T> = {
  data?: T | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Gọi API logout nếu có refreshToken, sau đó luôn xóa session local ở FE.
export const logout = async () => {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await api.post('/api/auth/logout', { refreshToken });
    }
  } finally {
    clearAuthSession();
  }
};

// Xác minh lại với backend rằng JWT hiện tại thật sự thuộc admin.
export const verifyAdminSession = async () => {
  const response = (await api.get('/api/auth-test/admin')) as unknown;

  if (!isRecord(response)) {
    throw new Error('Invalid admin verification response.');
  }

  const apiResponse = response as ApiResponse<AdminProfileResponse>;
  if (!isAdminRole(apiResponse.data?.role)) {
    throw new Error('Authenticated user is not an admin.');
  }
};
