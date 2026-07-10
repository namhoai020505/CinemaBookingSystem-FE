import api from '../lib/api';

export type DashboardFilter = {
  fromDate?: string;
  toDate?: string;
  cinemaId?: string;
};

export type DashboardOverview = {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  averageOrderValue: number;
  totalTicketsSold: number;
  totalSuccessfulBookings: number;
};

export type MovieRankingItem = {
  movieId: string;
  movieTitle: string;
  ticketRevenue: number;
  ticketsSold: number;
};

export type FbItemSales = {
  fbItemId: string;
  itemName: string;
  quantitySold: number;
  revenue: number;
};

export type OccupancyAndFbBreakdown = {
  occupancyRate: number;
  totalSoldSeats: number;
  totalAvailableSeatsCapacity: number;
  ticketRevenue: number;
  fbRevenue: number;
  fbRevenuePercentage: number;
  fbItems: FbItemSales[];
};

export type SalesChannelBreakdown = {
  channel: string;
  channelLabel: string;
  totalRevenue: number;
  bookingCount: number;
  percentage: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

const buildDashboardParams = (filter: DashboardFilter) => {
  const params: Record<string, string> = {};

  if (filter.fromDate) {
    params.FromDate = `${filter.fromDate}T00:00:00`;
  }

  if (filter.toDate) {
    params.ToDate = `${filter.toDate}T23:59:59`;
  }

  if (filter.cinemaId) {
    params.CinemaId = filter.cinemaId;
  }

  return params;
};

const unwrap = <T>(response: ApiEnvelope<T>) => response?.data;

export const dashboardService = {
  getOverview: async (filter: DashboardFilter): Promise<DashboardOverview> => {
    const response = (await api.get('/api/v1/admin/dashboard/overview', {
      params: buildDashboardParams(filter),
    })) as unknown as ApiEnvelope<DashboardOverview>;

    return unwrap(response);
  },

  getMovieRanking: async (filter: DashboardFilter): Promise<MovieRankingItem[]> => {
    const response = (await api.get('/api/v1/admin/dashboard/movie-ranking', {
      params: buildDashboardParams(filter),
    })) as unknown as ApiEnvelope<MovieRankingItem[]>;

    return unwrap(response) ?? [];
  },

  getOccupancyAndFb: async (
    filter: DashboardFilter,
  ): Promise<OccupancyAndFbBreakdown> => {
    const response = (await api.get('/api/v1/admin/dashboard/occupancy-and-fb', {
      params: buildDashboardParams(filter),
    })) as unknown as ApiEnvelope<OccupancyAndFbBreakdown>;

    return unwrap(response);
  },

  getSalesChannels: async (
    filter: DashboardFilter,
  ): Promise<SalesChannelBreakdown[]> => {
    const response = (await api.get('/api/v1/admin/dashboard/sales-channels', {
      params: buildDashboardParams(filter),
    })) as unknown as ApiEnvelope<SalesChannelBreakdown[]>;

    return unwrap(response) ?? [];
  },
};
