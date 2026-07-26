import api from '../lib/api';
import { roomService, type CinemaResponse, type RoomResponse } from './roomService';
import type { ShowtimeResponse } from './showtimeService';
import {
  parseScanTicketResponse,
  ticketScanEndpoints,
  type ConfirmTicketScanRequest,
  type ScanTicketFoodAndBeverageItem,
  type ScanTicketRequest,
  type ScanTicketResponse,
} from './scanTicketContract';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  errors?: unknown;
};

export type PagedList<T> = {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
};

export type CancelShowtimeResponse = {
  showtimeId: string;
  showtimeStatus: string;
  showtimeCancellationId: string;
  paidBookingsMovedToRefundPending: number;
  unpaidBookingsCancelled: number;
  refundsCreated: number;
  totalRefundAmount: number;
  refundsSucceeded: number;
  refundsManualRequired: number;
  refundsPending: number;
};

export type RefundItem = {
  refundId: string;
  bookingId: string;
  paymentId?: string;
  paymentProviderId?: string;
  paymentProviderName?: string;
  showtimeId: string;
  movieTitle: string;
  cinemaId?: string;
  cinemaName?: string;
  refundAmount: number;
  refundStatus: string;
  bookingStatus: string;
  workflowStatus?: string;
  claimStatus?: string | null;
  bankCode?: string | null;
  maskedAccountNumber?: string | null;
  refundReason?: string | null;
  providerRefundCode?: string | null;
  failureReason?: string | null;
  requestedAt: string;
  refundedAt?: string | null;
};

export type {
  ConfirmTicketScanRequest,
  ScanTicketFoodAndBeverageItem,
  ScanTicketRequest,
  ScanTicketResponse,
};

const unwrap = <T>(response: ApiEnvelope<T>) => response?.data as T;

export const managerService = {
  getShowtimes: async (): Promise<ShowtimeResponse[]> => {
    const response = (await api.get('/api/manager/showtimes')) as unknown as ApiEnvelope<ShowtimeResponse[]>;
    return unwrap(response) ?? [];
  },

  getRooms: (): Promise<RoomResponse[]> => roomService.getRooms(true),

  getCinemas: (): Promise<CinemaResponse[]> => roomService.getCinemas(),

  cancelShowtime: async (
    showtimeId: string,
    reason: string,
  ): Promise<CancelShowtimeResponse> => {
    const response = (await api.post(`/api/manager/showtimes/${showtimeId}/cancel`, {
      reason,
    })) as unknown as ApiEnvelope<CancelShowtimeResponse>;

    return unwrap(response);
  },

  getRefunds: async (
    status = 'PENDING',
    pageIndex = 1,
    pageSize = 20,
  ): Promise<PagedList<RefundItem>> => {
    const response = (await api.get('/api/manager/refunds', {
      params: { status },
    })) as unknown as ApiEnvelope<RefundItem[]>;

    const items = unwrap(response) ?? [];

    return {
      items,
      pageIndex,
      pageSize,
      totalCount: items.length,
    };
  },

  previewTicket: async (payload: ScanTicketRequest): Promise<ScanTicketResponse> => {
    const response = (await api.post(ticketScanEndpoints.preview, payload)) as unknown as ApiEnvelope<ScanTicketResponse>;
    return parseScanTicketResponse(unwrap(response));
  },

  confirmTicket: async (payload: ConfirmTicketScanRequest): Promise<ScanTicketResponse> => {
    const response = (await api.post(ticketScanEndpoints.confirm, payload)) as unknown as ApiEnvelope<ScanTicketResponse>;
    return parseScanTicketResponse(unwrap(response));
  },

  scanTicket: async (payload: ScanTicketRequest): Promise<ScanTicketResponse> => {
    const response = (await api.post(ticketScanEndpoints.legacyScan, payload)) as unknown as ApiEnvelope<ScanTicketResponse>;
    return parseScanTicketResponse(unwrap(response));
  },
};
