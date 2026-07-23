import api from '../lib/api';

export type ManagerDashboardFilter = {
  fromDate?: string;
  toDate?: string;
  movieId?: string;
};

export type ManagerDashboardResponse = {
  cinemaId?: string | null;
  cinemaName: string;
  from: string;
  to: string;
  movieId?: string | null;
  grossRevenue: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  manualRefundAmount: number;
  netRevenue: number;
  grossTicketsSold: number;
  refundedTickets: number;
  netTicketsSold: number;
  sellableSeatCapacity: number;
  occupiedSeats: number;
  occupancyRate: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

const unwrap = <T>(response: ApiEnvelope<T>) => response?.data as T;

const buildManagerDashboardParams = (filter: ManagerDashboardFilter) => {
  const params: Record<string, string> = {};

  if (filter.fromDate) {
    params.From = `${filter.fromDate}T00:00:00`;
  }

  if (filter.toDate) {
    params.To = `${filter.toDate}T23:59:59`;
  }

  if (filter.movieId) {
    params.MovieId = filter.movieId;
  }

  return params;
};

export const managerDashboardService = {
  getDashboard: async (filter: ManagerDashboardFilter): Promise<ManagerDashboardResponse> => {
    const response = (await api.get('/api/manager/dashboard', {
      params: buildManagerDashboardParams(filter),
    })) as unknown as ApiEnvelope<ManagerDashboardResponse>;

    return unwrap(response);
  },
};
