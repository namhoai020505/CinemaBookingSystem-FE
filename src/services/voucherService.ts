import api from '../lib/api';

export type DiscountType = 'PERCENT' | 'AMOUNT';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
export const VOUCHER_CATEGORIES = ['EVENT', 'FOOD_BEVERAGE', 'COMPENSATION'] as const;
export const VOUCHER_APPLICABLE_SCOPES = [
  'TOTAL_ORDER',
  'TICKET_ONLY',
  'FOOD_BEVERAGE_ONLY',
] as const;
export const VOUCHER_TARGET_TYPES = ['ALL_CUSTOMERS', 'SPECIFIC_CUSTOMERS'] as const;

export type VoucherCategory = (typeof VOUCHER_CATEGORIES)[number] | (string & {});
export type VoucherApplicableScope =
  | (typeof VOUCHER_APPLICABLE_SCOPES)[number]
  | (string & {});
export type VoucherTargetType = (typeof VOUCHER_TARGET_TYPES)[number] | (string & {});

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
  category?: VoucherCategory;
  applicableScope: VoucherApplicableScope;
  targetType: VoucherTargetType;
  targetCustomerIds: string | null;
  specificFbItemIds: string | null;
  isPrivate: boolean;
  requiredTicketCount?: number | null;
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
  category?: VoucherCategory;
  applicableScope?: VoucherApplicableScope;
  targetType?: VoucherTargetType;
  targetCustomerIds?: string | null;
  specificFbItemIds?: string | null;
  isPrivate?: boolean;
  requiredTicketCount?: number | null;
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
  category?: VoucherCategory;
  applicableScope?: VoucherApplicableScope;
  targetType?: VoucherTargetType;
  targetCustomerIds?: string | null;
  specificFbItemIds?: string | null;
  isPrivate?: boolean;
  requiredTicketCount?: number | null;
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
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
}

const isActiveCompensationVoucher = (voucher: Voucher) =>
  voucher.voucherStatus === 'ACTIVE' &&
  (voucher.category || '').toUpperCase() === 'COMPENSATION';

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

  getMyVouchers: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers/my-wallet'),

  claimVoucher: async (voucherId: string) =>
    api.post<unknown, ApiResponse<boolean>>(`/api/vouchers/${voucherId}/claim`),

  getCompensationVouchers: async () => {
    const response = await voucherService.getAllAdminVouchers(undefined, 'ACTIVE');
    return (response.data || []).filter(isActiveCompensationVoucher);
  },

  validateVoucher: async (code: string, bookingAmount: number) =>
    api.get<unknown, ApiResponse<ValidateVoucherResponse>>(`/api/vouchers/validate`, {
      params: { code, bookingAmount },
    }),

  getMyWallet: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers/my-wallet'),
};
