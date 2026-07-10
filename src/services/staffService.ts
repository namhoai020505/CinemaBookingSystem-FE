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

export const staffService = {
  createStaff: async (payload: CreateStaffPayload) =>
    api.post<unknown, ApiResponse<StaffInvitationData>>('/api/admin/staff', payload),
};
