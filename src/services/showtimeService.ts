import axiosInstance from '../lib/api';

// Kiểu dữ liệu khớp CinemaSystem.Contracts.Showtimes.ShowtimeResponse.
export interface ShowtimeResponse {
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomId: string;
  roomName: string;
  cinemaId: string;
  cinemaName: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: string;
  showtimeSeatCount: number;
}

// Payload tạo suất chiếu mới từ trang admin.
export interface CreateShowtimePayload {
  movieId: string;
  roomId: string;
  startTime: string;
  basePrice: number;
  status?: string;
}

// Payload cập nhật suất chiếu hiện có.
export interface UpdateShowtimePayload {
  movieId: string;
  roomId: string;
  startTime: string;
  basePrice: number;
  status?: string;
}

// Kiểu dữ liệu rạp dùng để lọc phòng khi xếp lịch chiếu.
export interface CinemaResponse {
  cinemaId: string;
  cinemaName: string;
  address: string;
  city: string;
  phoneNumber?: string;
  cinemaStatus: string;
}

// Kiểu dữ liệu phòng chiếu dùng trong màn kéo thả lịch chiếu.
export interface RoomResponse {
  roomId: string;
  cinemaId: string;
  cinemaName: string;
  roomName: string;
  capacity: number;
  roomStatus: string;
  seatCount: number;
}

// Kiểu dữ liệu phim rút gọn dùng để chọn phim khi tạo suất chiếu.
export interface MovieResponse {
  id: string;
  movieNameVn: string;
  genres?: string[];
  duration: number;
  imagePoster?: string;
  ageRating?: string;
  highlight?: string;
}

// Wrapper ApiResponse chuẩn backend; interceptor đã unwrap response.data một lớp.
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

// ============================================================
// Service methods
// ============================================================
export const showtimeService = {
  // GET /api/showtimes: lấy toàn bộ suất chiếu.
  getShowtimes: async (): Promise<ShowtimeResponse[]> => {
    const envelope = await axiosInstance.get('/api/showtimes') as unknown as ApiEnvelope<ShowtimeResponse[]>;
    return envelope?.data ?? [];
  },

  // POST /api/showtimes: tạo suất chiếu mới.
  createShowtime: async (payload: CreateShowtimePayload): Promise<ShowtimeResponse> => {
    const envelope = await axiosInstance.post('/api/showtimes', payload) as unknown as ApiEnvelope<ShowtimeResponse>;
    return envelope.data;
  },

  // PUT /api/showtimes/{id}: cập nhật suất chiếu.
  updateShowtime: async (showtimeId: string, payload: UpdateShowtimePayload): Promise<ShowtimeResponse> => {
    const envelope = await axiosInstance.put(`/api/showtimes/${showtimeId}`, payload) as unknown as ApiEnvelope<ShowtimeResponse>;
    return envelope.data;
  },

  // DELETE /api/showtimes/{id}: xóa suất chiếu.
  deleteShowtime: async (showtimeId: string): Promise<void> => {
    await axiosInstance.delete(`/api/showtimes/${showtimeId}`);
  },

  // GET /api/cinemas: lấy danh sách rạp để admin chọn rạp.
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const envelope = await axiosInstance.get('/api/cinemas') as unknown as ApiEnvelope<CinemaResponse[]>;
    return envelope?.data ?? [];
  },

  // GET /api/rooms/rooms: lấy danh sách phòng để xếp suất chiếu.
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
    return envelope?.data?.items ?? [];
  },
};
