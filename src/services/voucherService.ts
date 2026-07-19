import api from '../lib/api';

export type DiscountType = 'PERCENT' | 'AMOUNT';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export interface Voucher {
  voucherId: string;
  voucherCode: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  perCustomerLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  voucherStatus: VoucherStatus;
}

export interface CreateVoucherPayload {
  voucherCode: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  perCustomerLimit?: number;
  startDate: string;
  endDate: string;
}

export interface UpdateVoucherPayload {
  title?: string;
  description?: string;
  imageUrl?: string;
  voucherStatus: VoucherStatus;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  perCustomerLimit?: number;
  startDate: string;
  endDate: string;
}

export interface ValidateVoucherResponse {
  isValid: boolean;
  discountAmount: number;
  message?: string;
  errorCode?: string;
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
  getAllAdminVouchers: async (searchCode?: string, status?: string) =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/admin/vouchers', {
      params: { searchCode, status }
    }),

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

  validateVoucher: async (code: string, bookingAmount: number) =>
    api.get<unknown, ApiResponse<ValidateVoucherResponse>>(`/api/vouchers/validate`, {
      params: { code, bookingAmount },
    }),

  getMyWallet: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers/my-wallet'),

  claimVoucher: async (voucherId: string) =>
    api.post<unknown, ApiResponse<unknown>>(`/api/vouchers/${voucherId}/claim`),
};
