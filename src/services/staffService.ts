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

export type ManagedUser = {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  roleId: string;
  roleName: string;
  cinemaId?: string | null;
  cinemaName?: string | null;
  status: string;
  createdAt: string;
  isOnline?: boolean;
};

export type UpdateUserRoleCinemaPayload = {
  roleId: string;
  cinemaId?: string | null;
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

  getManagedUsers: async () =>
    api.get<unknown, ApiResponse<ManagedUser[]>>('/api/admin/users'),

  updateUserRoleCinema: async (userId: string, payload: UpdateUserRoleCinemaPayload) =>
    api.put<unknown, ApiResponse<ManagedUser>>(`/api/admin/users/${userId}/role-cinema`, payload),
};
