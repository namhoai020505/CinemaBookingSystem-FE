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

// Một số endpoint trả ApiResponse chuẩn, một số trả data trực tiếp; helper này gom về một format.
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

// Các API customer profile: xem/sửa thông tin, đổi mật khẩu, đổi email.
export const customerService = {
  // GET /api/customer/profile: lấy profile của tài khoản đang đăng nhập.
  getProfile: async () => {
    const response = await api.get('/api/customer/profile');
    return unwrapApiResponse<CustomerProfile>(response);
  },

  // PUT /api/customer/profile: cập nhật thông tin cá nhân như tên, SĐT, địa chỉ.
  updateProfile: async (request: UpdateCustomerProfileRequest) => {
    const response = await api.put('/api/customer/profile', request);
    return unwrapApiResponse<CustomerProfile>(response);
  },

  // POST /api/customer/change-password: đổi mật khẩu bằng mật khẩu cũ và mật khẩu mới.
  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await api.post('/api/customer/change-password', {
      oldPassword,
      newPassword,
    });
    return unwrapApiResponse(response);
  },

  // POST /api/customer/request-email-change: gửi OTP xác nhận đổi email mới.
  requestEmailChange: async (newEmail: string) => {
    const response = await api.post('/api/customer/request-email-change', {
      newEmail,
    });
    return unwrapApiResponse<RequestEmailChangeResponse>(response);
  },

  // POST /api/customer/verify-email-change: xác nhận OTP và hoàn tất đổi email.
  verifyEmailChange: async (newEmail: string, otp: string) => {
    const response = await api.post('/api/customer/verify-email-change', {
      newEmail,
      otp,
    });
    return unwrapApiResponse<{ email?: string }>(response);
  },
};
