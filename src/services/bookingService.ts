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
  compensationDiscountAmount?: number;
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
  compensationTicketCodes?: string[];
  foodItems?: {
    fbItemId: string;
    quantity: number;
  }[];
}

// Backend CreateBookingRequest shape
interface CreateBookingRequestPayload {
  showtimeId: string;
  showtimeSeatIds: string[];
  voucherCode?: string;
  compensationTicketCodes?: string[];
  foodAndBeverages?: {
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
  movieTitle?: string;
  cinemaName?: string;
  roomName?: string;
  startTime?: string | null;
  seats: CheckoutSeat[];
  foodItems: CheckoutFoodItem[];
  seatSubtotal: number;
  foodSubtotal: number;
  grossAmount: number;
  voucherDiscount: number;
  rewardDiscount: number;
  totalAmount: number;
  expiredAt: string | null;
  compensationDiscountAmount?: number;
};

export type CheckoutRecovery = {
  bookingId: string;
  showtimeId: string;
  bookingStatus: string;
  paymentStatus?: string | null;
  expiredAt?: string | null;
};

const HIDDEN_EXPIRED_BOOKINGS_KEY = 'g2c-hidden-expired-bookings';
const HIDDEN_CANCELLED_BOOKINGS_KEY = 'g2c-hidden-cancelled-bookings';

export const parseBackendTime = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  let str = value.trim();
  if (!str) {
    return 0;
  }
  if (!str.includes('T') && str.includes(' ')) {
    str = str.replace(' ', 'T');
  }
  if (!str.endsWith('Z') && !str.endsWith('z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += 'Z';
  }
  const timestamp = Date.parse(str);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getHiddenBookingIds = (storageKey: string) => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey) || '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
};

export const getHiddenExpiredBookingIds = () =>
  getHiddenBookingIds(HIDDEN_EXPIRED_BOOKINGS_KEY);

export const getHiddenCancelledBookingIds = () =>
  getHiddenBookingIds(HIDDEN_CANCELLED_BOOKINGS_KEY);

const hideBookingFromHistory = (storageKey: string, bookingId?: string | null) => {
  if (!bookingId || !canUseLocalStorage()) {
    return;
  }

  const bookingIds = new Set(getHiddenBookingIds(storageKey));
  bookingIds.add(bookingId);
  localStorage.setItem(storageKey, JSON.stringify(Array.from(bookingIds)));
};

export const hideExpiredBookingFromHistory = (bookingId?: string | null) =>
  hideBookingFromHistory(HIDDEN_EXPIRED_BOOKINGS_KEY, bookingId);

export const hideCancelledBookingFromHistory = (bookingId?: string | null) =>
  hideBookingFromHistory(HIDDEN_CANCELLED_BOOKINGS_KEY, bookingId);

export const isExpiredPendingBooking = (booking: BookingSummary) => {
  if (booking.status.toUpperCase() !== 'PENDING_PAYMENT') {
    return false;
  }

  const expiredAt = parseBackendTime(booking.expiredAt);
  return expiredAt > 0 && expiredAt <= Date.now();
};

export const shouldHideBookingFromHistory = (booking: BookingSummary) =>
  isExpiredPendingBooking(booking) ||
  getHiddenExpiredBookingIds().includes(booking.bookingId) ||
  getHiddenCancelledBookingIds().includes(booking.bookingId);

export const bookingService = {
  createBooking: async (payload: BookingPayload) => {
    const response = await axiosInstance.post('/api/bookings', payload) as unknown as ApiResponse<BookingSummary>;
    return response;
  },

  checkout: async (payload: CheckoutPayload, idempotencyKey: string) => {
    // Backend endpoint: POST /api/bookings (CreateBookingRequest)
    // Maps FE payload fields to the backend OpenAPI request shape.
    const bePayload: CreateBookingRequestPayload = {
      showtimeId: String(payload.showtimeId),
      showtimeSeatIds: payload.showtimeSeatIds.map(String),
    };

    if (payload.voucherCode?.trim()) {
      bePayload.voucherCode = payload.voucherCode.trim();
    }

    if (payload.compensationTicketCodes?.length) {
      bePayload.compensationTicketCodes = payload.compensationTicketCodes;
    }

    const foodAndBeverages = payload.foodItems
      ?.filter((item) => item.fbItemId && item.quantity > 0)
      .map((item) => ({
        fbItemId: item.fbItemId,
        quantity: item.quantity,
      }));

    if (foodAndBeverages?.length) {
      bePayload.foodAndBeverages = foodAndBeverages;
    }

    const raw = await axiosInstance.post('/api/bookings', bePayload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }) as unknown as ApiResponse<BookingSummary>;

    // Map BookingResponse → CheckoutResponse shape expected by Checkout.tsx
    if (!raw.success || !raw.data) {
      return raw as unknown as ApiResponse<CheckoutResponse>;
    }

    const booking = raw.data;
    const mapped: CheckoutResponse = {
      bookingId: booking.bookingId,
      bookingStatus: booking.status,
      showtimeId: booking.showtimeId,
      movieTitle: booking.movieTitle,
      cinemaName: booking.cinemaName,
      roomName: booking.roomName,
      startTime: booking.startTime ? String(booking.startTime) : null,
      seats: [],
      foodItems: [],
      seatSubtotal: 0,
      foodSubtotal: 0,
      grossAmount: booking.totalAmount,
      voucherDiscount: 0,
      rewardDiscount: 0,
      totalAmount: booking.totalAmount,
      expiredAt: booking.expiredAt ? String(booking.expiredAt) : null,
      compensationDiscountAmount: booking.compensationDiscountAmount,
    };

    return { ...raw, data: mapped } as ApiResponse<CheckoutResponse>;
  },

  getBookingById: async (bookingId: string | number) => {
    const response = await axiosInstance.get(`/api/bookings/${bookingId}`) as unknown as ApiResponse<BookingDetails>;
    return response;
  },

  recoverCheckout: async (idempotencyKey: string) => {
    const response = await axiosInstance.get('/api/bookings/checkout-recovery', {
      headers: { 'Idempotency-Key': idempotencyKey },
    }) as unknown as ApiResponse<CheckoutRecovery>;
    return response;
  },

  getMyBookings: async () => {
    const response = await axiosInstance.get('/api/bookings/my-bookings') as unknown as ApiResponse<BookingSummary[]>;
    return response;
  },

  cancelPendingBooking: async (bookingId: string | number) => {
    const response = await axiosInstance.post(`/api/bookings/${bookingId}/cancel`) as unknown as ApiResponse<void>;
    return response;
  },

  confirmTimeChange: async (
    bookingId: string,
    accept: boolean,
    token: string,
  ): Promise<ApiResponse<boolean>> => {
    const response = await axiosInstance.get(`/api/bookings/${bookingId}/confirm-time-change`, {
      params: { accept, token },
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json'
      }
    }) as unknown as ApiResponse<boolean>;
    return response;
  }
};
