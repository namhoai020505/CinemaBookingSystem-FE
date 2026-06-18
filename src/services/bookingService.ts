import axiosInstance from '../lib/api';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
  data: T;
};

export type BookingSummary = {
  bookingId: string;
  showtimeId: string;
  movieTitle?: string;
  cinemaName?: string;
  roomName?: string;
  startTime?: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  expiredAt?: string | null;
};

export type BookingSeatDetail = {
  seatId: string;
  seatNumber: string;
  rowLabel: string;
  seatType: string;
  price: number;
  ticketId?: string | null;
  ticketQrCode?: string | null;
  ticketStatus?: string | null;
};

export type BookingFbItem = {
  itemName: string;
  quantity: number;
  subtotal: number;
};

export type BookingDetails = {
  bookingId: string;
  showtimeId: string;
  movieTitle: string;
  cinemaName: string;
  roomName: string;
  startTime: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  seats: BookingSeatDetail[];
  foodAndBeverages: BookingFbItem[];
};

export interface BookingPayload {
  showtimeId: string | number;
  showtimeSeatIds: (string | number)[];
  voucherCode?: string;
  foodAndBeverages?: {
    fbItemId: string;
    quantity: number;
  }[];
}

export interface CheckoutPayload {
  showtimeId: string | number;
  showtimeSeatIds: (string | number)[];
  voucherCode?: string;
  foodItems?: {
    fbItemId: string;
    quantity: number;
  }[];
}

export type CheckoutSeat = {
  showtimeSeatId: string;
  seatCode: string;
  seatType: string;
  price: number;
};

export type CheckoutFoodItem = {
  fbItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type CheckoutResponse = {
  bookingId: string;
  bookingStatus: string;
  showtimeId: string;
  seats: CheckoutSeat[];
  foodItems: CheckoutFoodItem[];
  seatSubtotal: number;
  foodSubtotal: number;
  grossAmount: number;
  voucherDiscount: number;
  rewardDiscount: number;
  totalAmount: number;
  expiredAt: string;
};

const HIDDEN_EXPIRED_BOOKINGS_KEY = 'g2c-hidden-expired-bookings';

const normalizeBackendDate = (value?: string | null) => {
  if (!value) {
    return '';
  }

  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
};

const parseBackendTime = (value?: string | null) => {
  const timestamp = Date.parse(normalizeBackendDate(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getHiddenExpiredBookingIds = () => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      localStorage.getItem(HIDDEN_EXPIRED_BOOKINGS_KEY) || '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    localStorage.removeItem(HIDDEN_EXPIRED_BOOKINGS_KEY);
    return [];
  }
};

export const hideExpiredBookingFromHistory = (bookingId?: string | null) => {
  if (!bookingId || !canUseLocalStorage()) {
    return;
  }

  const bookingIds = new Set(getHiddenExpiredBookingIds());
  bookingIds.add(bookingId);
  localStorage.setItem(
    HIDDEN_EXPIRED_BOOKINGS_KEY,
    JSON.stringify(Array.from(bookingIds)),
  );
};

export const isExpiredPendingBooking = (booking: BookingSummary) => {
  if (booking.status.toUpperCase() !== 'PENDING_PAYMENT') {
    return false;
  }

  const expiredAt = parseBackendTime(booking.expiredAt);
  return expiredAt > 0 && expiredAt <= Date.now();
};

export const shouldHideBookingFromHistory = (booking: BookingSummary) =>
  isExpiredPendingBooking(booking) ||
  getHiddenExpiredBookingIds().includes(booking.bookingId);

export const bookingService = {
  createBooking: async (payload: BookingPayload) => {
    const response = await axiosInstance.post('/api/bookings', payload) as unknown as ApiResponse<BookingSummary>;
    return response;
  },

  checkout: async (payload: CheckoutPayload) => {
    const response = await axiosInstance.post('/api/bookings/checkout', payload) as unknown as ApiResponse<CheckoutResponse>;
    return response;
  },

  getBookingById: async (bookingId: string | number) => {
    const response = await axiosInstance.get(`/api/bookings/${bookingId}`) as unknown as ApiResponse<BookingDetails>;
    return response;
  },

  getMyBookings: async () => {
    const response = await axiosInstance.get('/api/bookings/my-bookings') as unknown as ApiResponse<BookingSummary[]>;
    return response;
  }
};
