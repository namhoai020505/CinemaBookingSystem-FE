import api from '../lib/api';

export type AssignableAccountRole = {
  roleId: string;
  roleName: string;
  description?: string | null;
  profileKind: string;
  requiresCinema: boolean;
};

export type CinemaOption = {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  cinemaStatus: string;
};

export type ProvisionManagedAccountPayload = {
  email: string;
  fullName?: string;
  roleId: string;
  cinemaId?: string;
};

export type ProvisionedAccountData = {
  userId?: string;
  email?: string;
  roleId?: string;
  roleName?: string;
  cinemaId?: string | null;
  invitationExpiresAt?: string;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

export const staffService = {
  getAssignableRoles: async () =>
    api.get<unknown, ApiResponse<AssignableAccountRole[]>>(
      '/api/admin/account-provisioning/roles',
    ),

  getCinemas: async () =>
    api.get<unknown, ApiResponse<CinemaOption[]>>('/api/cinemas'),

  provisionAccount: async (payload: ProvisionManagedAccountPayload) =>
    api.post<unknown, ApiResponse<ProvisionedAccountData>>('/api/admin/users', payload),
};
