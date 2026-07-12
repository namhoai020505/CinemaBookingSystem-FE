import api from '../lib/api';

export type DiscountType = 'Percentage' | 'FixedAmount';

export interface Voucher {
  voucherId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

export interface CreateVoucherPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  isActive: boolean;
}

export interface UpdateVoucherPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  isActive: boolean;
}

export interface ValidateVoucherResponse {
  isValid: boolean;
  discountAmount: number;
  message?: string;
  voucher?: Voucher;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
}

export const voucherService = {
  // Admin APIs
  getAllAdminVouchers: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/admin/vouchers'),

  getAdminVoucherById: async (voucherId: string) =>
    api.get<unknown, ApiResponse<Voucher>>(`/api/admin/vouchers/${voucherId}`),

  createVoucher: async (payload: CreateVoucherPayload) =>
    api.post<unknown, ApiResponse<Voucher>>('/api/admin/vouchers', payload),

  updateVoucher: async (voucherId: string, payload: UpdateVoucherPayload) =>
    api.put<unknown, ApiResponse<Voucher>>(`/api/admin/vouchers/${voucherId}`, payload),

  deleteVoucher: async (voucherId: string) =>
    api.delete<unknown, ApiResponse<unknown>>(`/api/admin/vouchers/${voucherId}`),

  // Public/Customer Vouchers APIs
  getActiveVouchers: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers'),

  validateVoucher: async (code: string, orderAmount: number) =>
    api.get<unknown, ApiResponse<ValidateVoucherResponse>>(`/api/vouchers/validate`, {
      params: { code, orderAmount },
    }),
};
