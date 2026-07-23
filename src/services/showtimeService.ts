import axiosInstance from '../lib/api';

// ============================================================
// Types khớp chuẩn Backend Contracts
// ============================================================

/** Khớp CinemaSystem.Contracts.Showtimes.ShowtimeResponse */
export interface ShowtimeResponse {
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomId: string;
  roomName: string;
  cinemaId: string;
  cinemaName: string;
  startTime: string;   // ISO 8601
  endTime: string;      // ISO 8601
  basePrice: number;
  status: string;       // OPEN | CLOSED | CANCELLED | COMPLETED
  showtimeSeatCount: number;
  hasBookings?: boolean;
}

/** Khớp CinemaSystem.Contracts.Showtimes.CreateShowtimeRequest */
export interface CreateShowtimePayload {
  movieId: string;
  roomId: string;
  startTime: string;    // ISO 8601
  basePrice: number;
  status?: string;      // default "OPEN"
}

/** Khớp CinemaSystem.Contracts.Showtimes.UpdateShowtimeRequest */
export interface UpdateShowtimePayload {
  movieId: string;
  roomId: string;
  startTime: string;    // ISO 8601
  basePrice: number;
  status?: string;      // default "OPEN"
  compensationVoucherCode?: string;
  compensationNote?: string;
}

/** Khớp CinemaSystem.Contracts.Cinemas.CinemaResponse */
export interface CinemaResponse {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus: string;
}

/** Khớp CinemaSystem.Contracts.Rooms.RoomResponse */
export interface RoomResponse {
  roomId: string;
  cinemaId: string;
  cinemaName: string;
  roomName: string;
  capacity: number;
  roomStatus: string;
  seatCount: number;
}

/** Khớp CinemaSystem.Contracts.Movies.MovieResponse */
export interface MovieResponse {
  id: string;
  movieNameVn: string;
  genres?: string[];
  duration: number;
  imagePoster?: string;
  ageRating?: string;
  highlight?: string;
  movieStatus?: string;
}

// ============================================================
// Wrapper giải nén ApiResponse<T> chuẩn BE
// (api interceptor đã trả response.data nên ta nhận ApiResponse)
// ============================================================
interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

/** Kớp cấu trúc PagedList<T> từ BE */
interface PagedListEnvelope<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}

export interface ChangeRoomPayload {
  newRoomId: string;
  seatMapping?: Record<string, string>;
  compensationVoucherCode?: string;
  compensationNote?: string;
}

// ============================================================
// Service methods
// ============================================================
export const showtimeService = {

  // ---------- Showtimes ----------

  /** GET /api/showtimes – lấy toàn bộ showtimes */
  getShowtimes: async (): Promise<ShowtimeResponse[]> => {
    const envelope = await axiosInstance.get('/api/showtimes') as unknown as ApiEnvelope<ShowtimeResponse[]>;
    return envelope?.data ?? [];
  },

  /** POST /api/showtimes – tạo showtime mới */
  createShowtime: async (payload: CreateShowtimePayload): Promise<ShowtimeResponse> => {
    const envelope = await axiosInstance.post('/api/showtimes', payload) as unknown as ApiEnvelope<ShowtimeResponse>;
    return envelope.data;
  },

  /** PUT /api/showtimes/{id} – cập nhật showtime */
  updateShowtime: async (showtimeId: string, payload: UpdateShowtimePayload): Promise<ShowtimeResponse> => {
    const envelope = await axiosInstance.put(`/api/showtimes/${showtimeId}`, payload) as unknown as ApiEnvelope<ShowtimeResponse>;
    return envelope.data;
  },

  /** POST /api/showtimes/{id}/change-room – đổi phòng chiếu chuyên dụng */
  changeRoom: async (showtimeId: string, payload: ChangeRoomPayload): Promise<ShowtimeResponse> => {
    const envelope = await axiosInstance.post(`/api/showtimes/${showtimeId}/change-room`, payload) as unknown as ApiEnvelope<ShowtimeResponse>;
    return envelope.data;
  },

  /** DELETE /api/showtimes/{id} – xóa showtime */
  deleteShowtime: async (showtimeId: string): Promise<void> => {
    await axiosInstance.delete(`/api/showtimes/${showtimeId}`);
  },

  // ---------- Helpers (Cinema, Room, Movie) ----------

  /** GET /api/cinemas */
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const envelope = await axiosInstance.get('/api/cinemas') as unknown as ApiEnvelope<CinemaResponse[]>;
    return envelope?.data ?? [];
  },

  /** GET /api/rooms/rooms */
  getRooms: async (): Promise<RoomResponse[]> => {
    const envelope = await axiosInstance.get('/api/rooms/rooms') as unknown as ApiEnvelope<RoomResponse[]>;
    return envelope?.data ?? [];
  },

  /** GET /api/movies – BE trả về PagedList<MovieResponse> */
  getMoviesForScheduling: async (): Promise<MovieResponse[]> => {
    const envelope = await axiosInstance.get('/api/movies', {
      params: { pageSize: 200 }  // Lấy đủ phim, không bị cắt trang
    }) as unknown as ApiEnvelope<PagedListEnvelope<MovieResponse>>;
    // BE trả về { data: { items: [...], pageIndex, pageSize, totalCount } }
    const allMovies = envelope?.data?.items ?? [];
    return allMovies.filter(m => m.movieStatus === 'NOW_SHOWING' || m.movieStatus === 'COMING_SOON');
  },
};