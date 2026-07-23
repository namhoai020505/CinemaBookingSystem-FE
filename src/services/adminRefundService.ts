import api from '../lib/api';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  errors?: unknown;
};

// ─── Response Types (mirrors ManualRefundResponse, RefundDto) ────────────────

export type AdminRefundItem = {
  bookingId: string;
  showtimeId: string;
  totalAmount: number;
  refundReason: string;
  bookingStatus: string;
  refundStatus: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  movieName: string;
  roomName: string;
  startTime: string;
  refundId: string;
  requestedAt: string;
};

export type AdminPagedList<T> = {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
};

export type ManualRefundItem = {
  refundId: string;
  bookingId: string;
  refundClaimId: string;
  refundStatus: string;
  claimStatus: string;
  processStatus: string;
  refundAmount: number;
  movieTitle: string;
  cinemaName: string;
  showtimeStartTime: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  assignedToUserId: string | null;
  bankTransactionCode: string | null;
  proofUrl: string | null;
  requestedAt: string;
  confirmedAt: string | null;
};

export type AssignManualRefundResponse = {
  refundId: string;
  manualRefundProcessId: string;
  processStatus: string;
  assignedToUserId: string;
  assignedAt: string;
};

export type RefundProcessingResponse = {
  refundId: string;
  refundStatus: string;
  bookingStatus: string;
  providerRefundCode: string | null;
  failureReason: string | null;
  rewardPointsReverted: number;
  alreadyProcessed: boolean;
};

// ─── Request Types ────────────────────────────────────────────────────────────

export type ManualConfirmPayload = {
  bankTransactionCode: string;
  transferredAmount: number;
  proofUrl: string;
  note?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const unwrap = <T>(envelope: ApiEnvelope<T>): T => envelope?.data as T;

// ─── Service ──────────────────────────────────────────────────────────────────

export const adminRefundService = {
  /**
   * GET /api/admin/refunds
   * Paginated list of all refunds, filterable by status.
   */
  getAdminRefunds: async (
    status = 'PENDING',
    pageIndex = 1,
    pageSize = 20,
  ): Promise<AdminPagedList<AdminRefundItem>> => {
    const response = (await api.get('/api/admin/refunds', {
      params: { status, pageIndex, pageSize },
    })) as unknown as ApiEnvelope<AdminPagedList<AdminRefundItem>>;
    return unwrap(response) ?? { items: [], pageIndex, pageSize, totalCount: 0 };
  },

  /**
   * POST /api/admin/refunds/{bookingId}/confirm
   * Confirm an automatic (gateway) refund.
   */
  confirmAutoRefund: async (bookingId: string): Promise<ApiEnvelope<unknown>> => {
    return (await api.post(
      `/api/admin/refunds/${bookingId}/confirm`,
      {},
    )) as unknown as ApiEnvelope<unknown>;
  },

  /**
   * GET /api/admin/refunds/manual
   * Returns manual refund processes that are Open or InProgress.
   */
  getManualRefunds: async (): Promise<ManualRefundItem[]> => {
    const response = (await api.get(
      '/api/admin/refunds/manual',
    )) as unknown as ApiEnvelope<ManualRefundItem[]>;
    return unwrap(response) ?? [];
  },

  /**
   * POST /api/admin/refunds/{refundId}/assign
   * Admin takes ownership of a manual refund (sets ProcessStatus → InProgress).
   */
  assignManualRefund: async (refundId: string): Promise<ApiEnvelope<AssignManualRefundResponse>> => {
    return (await api.post(
      `/api/admin/refunds/${refundId}/assign`,
      {},
    )) as unknown as ApiEnvelope<AssignManualRefundResponse>;
  },

  /**
   * POST /api/admin/refunds/{refundId}/manual-confirm
   * Record that the admin has physically transferred the money.
   * Payload: { bankTransactionCode, transferredAmount, proofUrl, note? }
   */
  confirmManualRefund: async (
    refundId: string,
    payload: ManualConfirmPayload,
  ): Promise<ApiEnvelope<RefundProcessingResponse>> => {
    return (await api.post(
      `/api/admin/refunds/${refundId}/manual-confirm`,
      payload,
    )) as unknown as ApiEnvelope<RefundProcessingResponse>;
  },
};
