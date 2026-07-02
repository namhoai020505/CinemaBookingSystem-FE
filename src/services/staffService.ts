import api from '../lib/api';

export type CreateStaffPayload = {
  email: string;
  fullName?: string;
};

export type StaffInvitationData = {
  email?: string;
  expiresAt?: string;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

// Gom API phân quyền staff cho admin.
export const staffService = {
  // POST /api/admin/staff: gửi lời mời tạo tài khoản staff tới email user.
  createStaff: async (payload: CreateStaffPayload) =>
    api.post<unknown, ApiResponse<StaffInvitationData>>('/api/admin/staff', payload),
};
