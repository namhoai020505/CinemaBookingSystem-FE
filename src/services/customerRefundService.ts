import api from '../lib/api';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  errors?: unknown;
};

// ─── Response Types ──────────────────────────────────────────────────────────

export type BankResponse = {
  bankCode: string;
  bankBin?: string;
  shortName: string;
  fullName: string;
};

export type RefundClaimResponse = {
  refundClaimId: string;
  refundId: string;
  bookingId: string;
  claimStatus: string;
  refundStatus: string;
  refundAmount: number;
  movieTitle: string;
  cinemaName: string;
  showtimeStartTime: string;
  bankCode?: string | null;
  bankName?: string | null;
  maskedAccountNumber?: string | null;
  accountHolderName?: string | null;
  expiresAt: string;
  submittedAt?: string | null;
};

export type SaveRefundBankAccountRequest = {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
};

export type RequestRefundLinkRequest = {
  bookingId: string;
  reason: string;
  ticketId?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const unwrap = <T>(envelope: ApiEnvelope<T>): T => envelope?.data as T;

// ─── Service ──────────────────────────────────────────────────────────────────

export const customerRefundService = {
  /**
   * GET /api/customer/banks
   * Get list of active bank directories.
   */
  getBanks: async (): Promise<BankResponse[]> => {
    const response = (await api.get(
      '/api/customer/banks',
    )) as unknown as ApiEnvelope<BankResponse[]>;
    return unwrap(response) ?? [];
  },

  /**
   * POST /api/customer/refund-claims/resolve
   * Resolve a refund claim token.
   */
  resolveClaim: async (token: string): Promise<RefundClaimResponse> => {
    const response = (await api.post('/api/customer/refund-claims/resolve', {
      token,
    })) as unknown as ApiEnvelope<RefundClaimResponse>;
    if (response?.success === false) {
      throw new Error(response.message || 'Không thể xác thực link hoàn tiền.');
    }
    const data = unwrap(response);
    if (!data) {
      throw new Error(response.message || 'Dữ liệu trả về trống.');
    }
    return data;
  },

  /**
   * PUT /api/customer/refund-claims/{claimId}/bank-account
   * Save customer bank account draft.
   */
  saveBankAccount: async (
    claimId: string,
    payload: SaveRefundBankAccountRequest,
  ): Promise<RefundClaimResponse> => {
    const response = (await api.put(
      `/api/customer/refund-claims/${claimId}/bank-account`,
      payload,
    )) as unknown as ApiEnvelope<RefundClaimResponse>;
    if (response?.success === false) {
      throw new Error(response.message || 'Không thể lưu thông tin ngân hàng.');
    }
    const data = unwrap(response);
    if (!data) {
      throw new Error(response.message || 'Lưu thông tin thất bại.');
    }
    return data;
  },

  /**
   * POST /api/customer/refund-claims/{claimId}/submit
   * Submit and lock bank account information.
   */
  submitClaim: async (claimId: string): Promise<RefundClaimResponse> => {
    const response = (await api.post(
      `/api/customer/refund-claims/${claimId}/submit`,
      {},
    )) as unknown as ApiEnvelope<RefundClaimResponse>;
    if (response?.success === false) {
      throw new Error(response.message || 'Gửi xác nhận thất bại.');
    }
    const data = unwrap(response);
    if (!data) {
      throw new Error(response.message || 'Xác nhận thất bại.');
    }
    return data;
  },

  /**
   * POST /api/customer/refund-requests
   * Request a new refund claim link.
   */
  requestNewLink: async (payload: RequestRefundLinkRequest): Promise<unknown> => {
    const response = (await api.post(
      '/api/customer/refund-requests',
      payload,
    )) as unknown as ApiEnvelope<unknown>;
    if (response?.success === false) {
      throw new Error(response.message || 'Gửi yêu cầu cấp lại link thất bại.');
    }
    return response;
  },
};
