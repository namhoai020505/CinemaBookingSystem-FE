import api from '../lib/api';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

export type CustomerProfile = {
  userId: string;
  customerProfileId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  memberLevel: string;
  rewardPoints: number;
  status: string;
  emailVerified: boolean;
};

export type UpdateCustomerProfileRequest = {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  avatarUrl?: string;
  gender?: string;
  dateOfBirth?: string;
};

export type RequestEmailChangeResponse = {
  expiresAt?: string;
};

const unwrapApiResponse = <T>(response: unknown): ApiResponse<T> => {
  if (typeof response === 'object' && response !== null && 'success' in response) {
    return response as ApiResponse<T>;
  }

  return {
    success: true,
    message: 'Success',
    data: response as T,
  };
};

export const customerService = {
  getProfile: async () => {
    const response = await api.get('/api/customer/profile');
    return unwrapApiResponse<CustomerProfile>(response);
  },

  updateProfile: async (request: UpdateCustomerProfileRequest) => {
    const response = await api.put('/api/customer/profile', request);
    return unwrapApiResponse<CustomerProfile>(response);
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await api.post('/api/customer/change-password', {
      oldPassword,
      newPassword,
    });
    return unwrapApiResponse(response);
  },

  requestEmailChange: async (newEmail: string) => {
    const response = await api.post('/api/customer/request-email-change', {
      newEmail,
    });
    return unwrapApiResponse<RequestEmailChangeResponse>(response);
  },

  verifyEmailChange: async (newEmail: string, otp: string, oldEmailOtp: string) => {
    const response = await api.post('/api/customer/verify-email-change', {
      newEmail,
      otp,
      oldEmailOtp,
    });
    return unwrapApiResponse<{ email?: string }>(response);
  },
};
