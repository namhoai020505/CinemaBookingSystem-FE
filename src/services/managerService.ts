import api from '../lib/api';
import {
  dashboardService,
  type DashboardFilter,
  type DashboardOverview,
  type MovieRankingItem,
  type OccupancyAndFbBreakdown,
  type SalesChannelBreakdown,
} from './dashboardService';
import { roomService, type CinemaResponse, type RoomResponse } from './roomService';
import type { ShowtimeResponse } from './showtimeService';

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

export type ScanTicketRequest = {
  qrCode: string;
  roomId: string;
};

export type ScanTicketResponse = {
  ticketId: string;
  ticketStatus: string;
  checkInLogId: string;
  scanTime: string;
  bookingId: string;
  cinemaId: string;
  cinemaName: string;
  roomId: string;
  roomName: string;
  showtimeId: string;
  showtimeStartTime: string;
  showtimeEndTime: string;
  movieTitle: string;
  seatCode: string;
};

const unwrap = <T>(response: ApiEnvelope<T>) => response?.data as T;

export const managerService = {
  getDashboardOverview: (filter: DashboardFilter): Promise<DashboardOverview> =>
    dashboardService.getOverview(filter),

  getMovieRanking: (filter: DashboardFilter): Promise<MovieRankingItem[]> =>
    dashboardService.getMovieRanking(filter),

  getOccupancyAndFb: (filter: DashboardFilter): Promise<OccupancyAndFbBreakdown> =>
    dashboardService.getOccupancyAndFb(filter),

  getSalesChannels: (filter: DashboardFilter): Promise<SalesChannelBreakdown[]> =>
    dashboardService.getSalesChannels(filter),

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

  scanTicket: async (payload: ScanTicketRequest): Promise<ScanTicketResponse> => {
    const response = (await api.post('/api/tickets/scan', payload)) as unknown as ApiEnvelope<ScanTicketResponse>;
    return unwrap(response);
  },
};
