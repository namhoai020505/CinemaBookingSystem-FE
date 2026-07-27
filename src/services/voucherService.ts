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
  // Thêm mới
  showtimeId?: string | null;
  roomId?: string | null;
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
  // Thêm mới
  showtimeId?: string | null;
  roomId?: string | null;
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
  // Thêm mới
  showtimeId?: string | null;
  roomId?: string | null;
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

// Thêm mới
type CustomerLookupParams = {
  showtimeId?: string;
  roomId?: string;
};

export const VOUCHER_WALLET_UPDATED_EVENT = 'g2c-voucher-wallet-updated';

const isActiveCompensationVoucher = (voucher: Voucher) =>
  voucher.voucherStatus === 'ACTIVE' &&
  (voucher.category || '').toUpperCase() === 'COMPENSATION';

const getApiStatus = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }

  return undefined;
};

export const isPrivateOrCustomerScopedVoucher = (voucher: Voucher) =>
  voucher.isPrivate ||
  (voucher.targetType || '').toUpperCase() === 'SPECIFIC_CUSTOMERS' ||
  Boolean(voucher.targetCustomerIds?.trim());

export const isPublicVoucher = (voucher: Voucher) =>
  !voucher.isPrivate &&
  (voucher.targetType || 'ALL_CUSTOMERS').toUpperCase() !== 'SPECIFIC_CUSTOMERS' &&
  !voucher.targetCustomerIds?.trim();

export const isVoucherCurrentlyAvailable = (voucher: Voucher) => {
  const now = Date.now();
  const startTime = new Date(voucher.startDate).getTime();
  const endTime = new Date(voucher.endDate).getTime();
  const usedCount = voucher.usedCount ?? 0;

  return (
    voucher.voucherStatus === 'ACTIVE' &&
    (Number.isNaN(startTime) || startTime <= now) &&
    (Number.isNaN(endTime) || endTime >= now) &&
    usedCount < voucher.usageLimit
  );
};

export const mergeVoucherLists = (...voucherLists: Voucher[][]) => {
  const voucherMap = new Map<string, Voucher>();

  voucherLists.flat().forEach((voucher) => {
    if (!voucherMap.has(voucher.voucherId)) {
      voucherMap.set(voucher.voucherId, voucher);
    }
  });

  return Array.from(voucherMap.values());
};

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

  // Thêm mới
  getCustomerIdsByShowtimeOrRoom: async (
    showtimeId?: string | null,
    roomId?: string | null,
  ) => {
    const params: CustomerLookupParams = {};
    const normalizedShowtimeId = showtimeId?.trim();
    const normalizedRoomId = roomId?.trim();

    if (normalizedShowtimeId) {
      params.showtimeId = normalizedShowtimeId;
    }

    if (normalizedRoomId) {
      params.roomId = normalizedRoomId;
    }

    return api.get<unknown, ApiResponse<string[]>>(
      '/api/admin/vouchers/customers-by-showtime',
      { params },
    );
  },

  // Public/Customer Vouchers APIs
  getActiveVouchers: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers'),

  getMyVouchers: async () =>
    api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers/my-wallet'),

  getClaimableVouchers: async () => {
    try {
      return await api.get<unknown, ApiResponse<Voucher[]>>('/api/vouchers/claimable');
    } catch (error) {
      const status = getApiStatus(error);

      if (status === 404 || status === 405) {
        return voucherService.getActiveVouchers();
      }

      throw error;
    }
  },

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
