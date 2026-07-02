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
  foodAndBeverages?: {
    fbItemId: string;
    quantity: number;
  }[];
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
  bookingStatus?: string;
  status?: string;
  showtimeId: string;
  movieTitle?: string;
  cinemaName?: string;
  roomName?: string;
  startTime?: string | null;
  seats?: CheckoutSeat[];
  foodItems?: CheckoutFoodItem[];
  seatSubtotal?: number;
  foodSubtotal?: number;
  grossAmount?: number;
  voucherDiscount?: number;
  rewardDiscount?: number;
  totalAmount: number;
  createdAt?: string;
  expiredAt?: string | null;
};

const HIDDEN_EXPIRED_BOOKINGS_KEY = 'g2c-hidden-expired-bookings';

// Chuẩn hóa thời gian backend trả về để Date.parse đọc ổn cả khi thiếu timezone.
const normalizeBackendDate = (value?: string | null) => {
  if (!value) {
    return '';
  }

  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
};

// Parse chuỗi thời gian backend thành timestamp; lỗi thì trả 0 để xử lý an toàn.
const parseBackendTime = (value?: string | null) => {
  const timestamp = Date.parse(normalizeBackendDate(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

// Kiểm tra localStorage có dùng được không, tránh lỗi khi render ngoài browser.
const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Lấy danh sách booking pending đã hết hạn mà FE chủ động ẩn khỏi lịch sử.
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

// Ghi một booking hết hạn vào localStorage để trang "Vé của tôi" không hiển thị nữa.
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

// Kiểm tra booking pending payment đã quá expiredAt chưa.
export const isExpiredPendingBooking = (booking: BookingSummary) => {
  if (booking.status.toUpperCase() !== 'PENDING_PAYMENT') {
    return false;
  }

  const expiredAt = parseBackendTime(booking.expiredAt);
  return expiredAt > 0 && expiredAt <= Date.now();
};

// Điều kiện chung để lọc booking khỏi lịch sử: đã hết hạn hoặc đã được FE đánh dấu ẩn.
export const shouldHideBookingFromHistory = (booking: BookingSummary) =>
  isExpiredPendingBooking(booking) ||
  getHiddenExpiredBookingIds().includes(booking.bookingId);

// Gom các API liên quan tới tạo booking, checkout và lịch sử vé.
export const bookingService = {
  // POST /api/bookings: tạo booking cơ bản từ showtime và ghế.
  createBooking: async (payload: BookingPayload) => {
    const response = await axiosInstance.post('/api/bookings', payload) as unknown as ApiResponse<BookingSummary>;
    return response;
  },

  // Lưu ý: BE hiện chưa có POST /api/bookings/checkout, nên checkout gọi POST /api/bookings.
  checkout: async (payload: CheckoutPayload) => {
    const response = await axiosInstance.post('/api/bookings', {
      showtimeId: payload.showtimeId,
      showtimeSeatIds: payload.showtimeSeatIds,
      voucherCode: payload.voucherCode,
      foodAndBeverages: payload.foodAndBeverages ?? payload.foodItems,
    }) as unknown as ApiResponse<CheckoutResponse>;
    return response;
  },

  // GET /api/bookings/{bookingId}: lấy chi tiết vé để hiển thị QR/check-in.
  getBookingById: async (bookingId: string | number) => {
    const response = await axiosInstance.get(`/api/bookings/${bookingId}`) as unknown as ApiResponse<BookingDetails>;
    return response;
  },

  // GET /api/bookings/my-bookings: lấy lịch sử vé của customer đang đăng nhập.
  getMyBookings: async () => {
    const response = await axiosInstance.get('/api/bookings/my-bookings') as unknown as ApiResponse<BookingSummary[]>;
    return response;
  },

  // POST /api/bookings/{bookingId}/cancel: huy booking pending va tra ghe ve trang thai co the dat lai.
  cancelPendingBooking: async (bookingId: string | number) => {
    const response = await axiosInstance.post(`/api/bookings/${bookingId}/cancel`) as unknown as ApiResponse<boolean>;
    return response;
  }
};
